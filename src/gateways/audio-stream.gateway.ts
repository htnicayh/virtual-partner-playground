import { LiveServerMessage, Modality } from '@google/genai'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { EVENTS, EVENTS_EMIT } from '../commons/constants'
import { LiveAPIConfig } from '../commons/interfaces/live-api.interface'
import { AudioChunk, EndStream, StartStream } from '../commons/interfaces/message-body.interface'
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'

@WebSocketGateway({
	cors: {
		origin: process.env.FRONTEND_URL || '*',
		credentials: true
	},
	namespace: '/audio'
})
@Injectable()
export class AudioStreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger(AudioStreamGateway.name)

	private readonly systemInstruction: string
	private readonly geminiModel: string

	@WebSocketServer()
	server: Server

	constructor(
		private readonly configService: ConfigService,
		private readonly audioService: AudioService,
		private readonly cacheService: CacheService,
		private readonly llmService: LlmService
	) {
		this.systemInstruction = `You are an English conversation teacher. 
Your role is to:
1. Engage in natural English conversations
2. Correct grammar and pronunciation errors gently
3. Suggest better ways to phrase sentences
4. Provide explanations for grammar rules
5. Ask follow-up questions to encourage dialogue
6. Adapt your level to the user's proficiency level
Keep responses conversational and encouraging.`

		this.geminiModel =
			this.configService.get<string>('GOOGLE_GEMINI_MODEL') || (process.env.GOOGLE_GEMINI_MODEL as string)
	}

	async handleConnection(client: Socket) {
		const clientID = client.id

		this.logger.log(`[${clientID}] Client connected`)

		client.emit(EVENTS_EMIT.CONNECTION, {
			status: 'connected',
			socketId: clientID,
			timestamp: Date.now()
		})
	}

	async handleDisconnect(client: Socket) {
		const clientID = client.id

		this.logger.log(`[${clientID}] Client disconnected`)

		const session = await this.cacheService.getSessionState(clientID)

		if (session?.isClosed) {
			await Promise.allSettled([
				this.cacheService.clearClientCaches(clientID),
				this.audioService.clearAudioSession(clientID)
			])

			this.logger.debug(`[${clientID}] Session cleaned up: ${clientID}`)
		} else {
			this.logger.debug(`[${clientID}] Session kept alive for reconnection: ${clientID}`)
		}
	}

	@SubscribeMessage(EVENTS.START_STREAM)
	async handleStartStream(@ConnectedSocket() client: Socket, @MessageBody() mb: StartStream) {
		const clientID = client.id

		try {
			await this.audioService.createAudioSession(clientID, mb.sessionId, mb.conversationId)

			this.logger.log(`[${clientID}] Creating Live API session for ${mb.userId}`)

			const config: LiveAPIConfig = {
				model: this.geminiModel,
				responseModalities: [Modality.AUDIO],
				systemInstruction: this.systemInstruction,
				inputAudioTranscription: {},
				outputAudioTranscription: {}
			}

			await this.llmService.createLiveSession(
				clientID,
				config,
				(message: LiveServerMessage) => this.handleLiveAPIMessage(client, message),
				(error: Error) => this.handleLiveAPIError(client, error),
				(reason: string) => this.handleLiveAPIClose(client, reason)
			)

			this.logger.log(`[${clientID}] Live API session ready`)

			client.emit(EVENTS_EMIT.LIVE_SESSION_READY, {
				sessionKey: clientID,
				status: 'live-streaming',
				timestamp: Date.now()
			})

			client.emit(EVENTS_EMIT.STREAM_STARTED, {
				sessionKey: clientID,
				status: 'streaming',
				timestamp: Date.now()
			})
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to start Live API session: ${e.message}`)

			client.emit(EVENTS_EMIT.ERROR, {
				code: 'LIVE_SESSION_START_FAILED',
				message: e.message
			})
		}
	}

	@SubscribeMessage(EVENTS.AUDIO_CHUNK)
	async handleAudioChunk(@ConnectedSocket() client: Socket, @MessageBody() mb: AudioChunk) {
		const clientID = client.id

		try {
			const { chunk, chunkIndex } = mb
			const buffer = Buffer.from(chunk, 'base64')

			await this.llmService.sendRealtimeAudio(clientID, buffer)

			const audio = await this.audioService.addAudioChunk(clientID, chunk, chunkIndex)

			client.emit(EVENTS_EMIT.CHUNK_RECEIVED, {
				chunkIndex: chunkIndex,
				bytesReceived: audio.totalBytes,
				duration: Date.now() - audio.startTime,
				timestamp: Date.now()
			})
		} catch (e) {
			if (e.message.includes('not found') || e.message.includes('inactive')) {
				this.logger.warn(`[${clientID}] Ignoring chunk after session closed`)

				return
			}

			this.logger.error(`[${clientID}] Failed to process chunk: ${e.message}`)

			client.emit(EVENTS_EMIT.ERROR, {
				code: 'CHUNK_FAILED',
				message: e.message
			})
		}
	}

	@SubscribeMessage(EVENTS.END_STREAM)
	async handleEndStream(@ConnectedSocket() client: Socket, @MessageBody() mb: EndStream) {
		const clientID = client.id

		try {
			this.logger.log(`[${clientID}] End stream signal received (Live API streams continuously)`)

			client.emit(EVENTS_EMIT.PROCESSING, {
				status: 'streaming-complete',
				timestamp: Date.now()
			})
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to handle end stream: ${e.message}`)

			client.emit(EVENTS_EMIT.ERROR, {
				code: 'STREAM_END_FAILED',
				message: e.message
			})
		}
	}

	@SubscribeMessage(EVENTS.CANCEL_STREAM)
	async handleCancelStream(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
		const clientID = client.id

		try {
			this.logger.log(`[${clientID}] Stream cancelled`)

			await Promise.allSettled([
				this.audioService.clearAudioSession(clientID),
				this.llmService.closeLiveSession(clientID)
			])

			client.emit(EVENTS_EMIT.STREAM_CANCELLED, { status: 'cancelled', timestamp: Date.now() })
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to cancel stream: ${e.message}`)

			client.emit(EVENTS_EMIT.ERROR, { code: 'CANCEL_FAILED', message: e.message })
		}
	}

	@SubscribeMessage(EVENTS.END_CONVERSATION)
	async handleEndConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
		const clientID = client.id

		try {
			this.logger.log(`[${clientID}] End conversation signal received`)

			await this.cacheService.setSessionState(clientID, {
				isClosed: true,
				closedAt: Date.now()
			})

			await Promise.allSettled([
				this.cacheService.clearClientCaches(clientID),
				this.audioService.clearAudioSession(clientID),
				this.llmService.closeLiveSession(clientID)
			])

			this.logger.debug(`[${clientID}] Session and Live API closed`)

			client.emit(EVENTS_EMIT.CONVERSATION_ENDED, {
				status: 'closed',
				message: 'Conversation session closed',
				timestamp: Date.now()
			})
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to end conversation: ${e.message}`)

			client.emit(EVENTS_EMIT.ERROR, {
				code: 'CONVERSATION_END_FAILED',
				message: e.message
			})
		}
	}

	private handleLiveAPIMessage(client: Socket, message: LiveServerMessage) {
		const clientID = client.id

		try {
			this.logger.debug(`[${clientID}] Processing Live API message`)

			if (message.serverContent?.interrupted) {
				this.logger.log(`[${clientID}] Live API interrupted`)

				client.emit(EVENTS_EMIT.LIVE_INTERRUPTED, {
					timestamp: Date.now()
				})

				return
			}

			// Handle model response turn
			if (message.serverContent?.modelTurn?.parts) {
				const parts = message.serverContent.modelTurn.parts

				let transcriptText = ''
				let hasAudio = false

				this.logger.debug(`[${clientID}] Model turn has ${parts.length} parts`)

				for (const part of parts) {
					// Extract text from model response
					if (part.text) {
						transcriptText += part.text
					}

					// Extract audio from model response
					if (part.inlineData?.data) {
						const audioBuffer = Buffer.from(part.inlineData.data, 'base64')

						hasAudio = true

						client.emit(EVENTS_EMIT.LIVE_AUDIO_CHUNK, {
							audio: part.inlineData.data,
							mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
							timestamp: Date.now()
						})

						this.logger.debug(`[${clientID}] Audio chunk emitted: ${audioBuffer.length} bytes`)
					}
				}

				// Emit AI transcript
				if (transcriptText.trim()) {
					client.emit(EVENTS_EMIT.LIVE_TRANSCRIPT, {
						text: transcriptText.trim(),
						timestamp: Date.now()
					})

					client.emit(EVENTS_EMIT.AI_RESPONSE, {
						text: transcriptText.trim(),
						timestamp: Date.now()
					})

					this.logger.log(`[${clientID}] AI Transcript emitted: "${transcriptText.substring(0, 50)}..."`)
				}

				// Emit when turn is complete
				if (message.serverContent.turnComplete) {
					client.emit(EVENTS_EMIT.RESPONSE_COMPLETE, {
						aiResponse: transcriptText.trim(),
						hasAudio,
						timestamp: Date.now()
					})
				}
			}

			// Handle user content with outputTranscription
			if (message.serverContent?.inputTranscription?.text) {
				const userTranscript = message.serverContent.inputTranscription.text

				if (userTranscript.trim()) {
					this.logger.log(`[${clientID}] User transcript: "${userTranscript.trim()}"`)

					client.emit(EVENTS_EMIT.USER_TRANSCRIPT, {
						text: userTranscript.trim(),
						timestamp: Date.now()
					})
				}
			}

			// Handle outputTranscription (AI's transcribed response)
			if (message.serverContent?.outputTranscription?.text) {
				const outputTranscriptionText = message.serverContent.outputTranscription.text

				this.logger.log(`[${clientID}] Output transcription: "${outputTranscriptionText}"`)

				client.emit(EVENTS_EMIT.AI_RESPONSE, {
					text: outputTranscriptionText,
					timestamp: Date.now()
				})
			}
		} catch (error) {
			this.logger.error(`[${clientID}] Error handling Live API message: ${(error as Error).message}`)

			client.emit(EVENTS_EMIT.ERROR, {
				code: 'LIVE_API_MESSAGE_ERROR',
				message: (error as Error).message
			})
		}
	}

	private handleLiveAPIError(client: Socket, error: Error) {
		const clientID = client.id

		this.logger.error(`[${clientID}] Live API error: ${error.message}`)

		client.emit(EVENTS_EMIT.ERROR, {
			code: 'LIVE_API_ERROR',
			message: error.message,
			timestamp: Date.now()
		})
	}

	private async handleLiveAPIClose(client: Socket, reason: string) {
		const clientID = client.id

		this.logger.log(`[${clientID}] Live API closed: ${reason}`)

		await this.llmService.closeLiveSession(clientID)

		client.emit(EVENTS_EMIT.PROCESSING, {
			status: 'live-session-closed',
			reason,
			timestamp: Date.now()
		})
	}
}
