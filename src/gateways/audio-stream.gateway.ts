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
import { AudioChunk, StartStream } from '../commons/interfaces/message-body.interface'
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

		client.emit(EVENTS_EMIT.CONNECTION, { status: 'connected', socketId: clientID, timestamp: Date.now() })
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
		}
	}

	@SubscribeMessage(EVENTS.START_STREAM)
	async handleStartStream(@ConnectedSocket() client: Socket, @MessageBody() mb: StartStream) {
		const clientID = client.id

		try {
			await this.audioService.createAudioSession(clientID, mb.sessionId, mb.conversationId)

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

			client.emit(EVENTS_EMIT.LIVE_SESSION_READY, {
				sessionKey: clientID,
				status: 'live-streaming',
				timestamp: Date.now()
			})

			client.emit(EVENTS_EMIT.STREAM_STARTED, { sessionKey: clientID, status: 'streaming', timestamp: Date.now() })
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to start Live API session: ${e.message}`)

			client.emit(EVENTS_EMIT.ERROR, { code: 'LIVE_SESSION_START_FAILED', message: e.message })
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
				chunkIndex,
				bytesReceived: audio.totalBytes,
				duration: Date.now() - audio.startTime,
				timestamp: Date.now()
			})
		} catch (e) {
			if (e.message.includes('not found') || e.message.includes('inactive')) {
				return
			}

			this.logger.error(`[${clientID}] Failed to process chunk: ${e.message}`)

			client.emit(EVENTS_EMIT.ERROR, { code: 'CHUNK_FAILED', message: e.message })
		}
	}

	@SubscribeMessage(EVENTS.END_STREAM)
	async handleEndStream(@ConnectedSocket() client: Socket) {
		client.emit(EVENTS_EMIT.PROCESSING, { status: 'streaming-complete', timestamp: Date.now() })
	}

	@SubscribeMessage(EVENTS.CANCEL_STREAM)
	async handleCancelStream(@ConnectedSocket() client: Socket) {
		const clientID = client.id

		await Promise.allSettled([
			this.audioService.clearAudioSession(clientID),
			this.llmService.closeLiveSession(clientID),
			this.cacheService.clearAIAudioChunks(clientID)
		])

		client.emit(EVENTS_EMIT.STREAM_CANCELLED, { status: 'cancelled', timestamp: Date.now() })
	}

	@SubscribeMessage(EVENTS.END_CONVERSATION)
	async handleEndConversation(@ConnectedSocket() client: Socket) {
		const clientID = client.id

		await this.cacheService.setSessionState(clientID, { isClosed: true, closedAt: Date.now() })
		await Promise.allSettled([
			this.cacheService.clearClientCaches(clientID),
			this.audioService.clearAudioSession(clientID),
			this.llmService.closeLiveSession(clientID)
		])

		client.emit(EVENTS_EMIT.CONVERSATION_ENDED, {
			status: 'closed',
			message: 'Conversation session closed',
			timestamp: Date.now()
		})
	}

	private async handleLiveAPIMessage(client: Socket, message: LiveServerMessage) {
		const clientID = client.id

		try {
			if (message.serverContent?.interrupted) {
				await this.cacheService.clearAIAudioChunks(clientID)
				await this.cacheService.setAIResponse(clientID, '')

				client.emit(EVENTS_EMIT.LIVE_INTERRUPTED, { timestamp: Date.now() })

				return
			}

			if (message.serverContent?.modelTurn?.parts) {
				for (const part of message.serverContent.modelTurn.parts) {
					if (part.inlineData?.data) {
						await this.cacheService.appendAIAudioChunk(clientID, part.inlineData.data)

						client.emit(EVENTS_EMIT.LIVE_AUDIO_CHUNK, {
							audio: part.inlineData.data,
							mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
							timestamp: Date.now()
						})
					}
				}
			}

			if (message.serverContent?.inputTranscription?.text) {
				const text = message.serverContent.inputTranscription.text.trim()

				if (text) {
					client.emit(EVENTS_EMIT.USER_TRANSCRIPT, { text, timestamp: Date.now() })
				}
			}

			if (message.serverContent?.outputTranscription?.text) {
				const current = (await this.cacheService.getAIResponse(clientID)) || ''
				const updated = current + message.serverContent.outputTranscription.text

				await this.cacheService.setAIResponse(clientID, updated)

				client.emit(EVENTS_EMIT.AI_RESPONSE, { text: updated, isFinal: false, timestamp: Date.now() })
			}

			if (message.serverContent?.generationComplete) {
				const finalText = (await this.cacheService.getAIResponse(clientID)) || ''
				const audioChunks = await this.cacheService.getAIAudioChunks(clientID)

				client.emit(EVENTS_EMIT.AI_RESPONSE, { text: finalText, isFinal: true, timestamp: Date.now() })
				client.emit(EVENTS_EMIT.AI_AUDIO_COMPLETE, { audioChunks, text: finalText, timestamp: Date.now() })
				client.emit(EVENTS_EMIT.RESPONSE_COMPLETE, { aiResponse: finalText, timestamp: Date.now() })

				await this.cacheService.clearAIAudioChunks(clientID)
				await this.cacheService.setAIResponse(clientID, '')
			}
		} catch (error) {
			this.logger.error(`[${clientID}] Error handling Live API message: ${(error as Error).message}`)

			client.emit(EVENTS_EMIT.ERROR, { code: 'LIVE_API_MESSAGE_ERROR', message: (error as Error).message })
		}
	}

	private handleLiveAPIError(client: Socket, error: Error) {
		const clientID = client.id

		this.logger.error(`[${clientID}] Live API error: ${error.message}`)

		client.emit(EVENTS_EMIT.ERROR, { code: 'LIVE_API_ERROR', message: error.message, timestamp: Date.now() })
	}

	private async handleLiveAPIClose(client: Socket, reason: string) {
		const clientID = client.id

		this.logger.log(`[${clientID}] Live API closed: ${reason}`)

		await this.llmService.closeLiveSession(clientID)

		client.emit(EVENTS_EMIT.PROCESSING, { status: 'live-session-closed', reason, timestamp: Date.now() })
	}
}
