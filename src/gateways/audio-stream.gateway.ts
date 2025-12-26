import { Injectable, Logger } from '@nestjs/common'
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
import { StreamingSession } from '../commons/interfaces/streaming-session.interface'
import { ConversationService } from '../services/conversation.service'
import { LlmService } from '../services/llm.service'
import { SessionService } from '../services/session.service'
import { STTService } from '../services/speech-to-text.service'
import { TTSService } from '../services/text-to-speech.service'

@WebSocketGateway({
	cors: {
		origin: process.env.FRONTEND_URL || 'http://localhost:5173',
		credentials: true
	},
	namespace: '/audio'
})
@Injectable()
export class AudioStreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger(AudioStreamGateway.name)

	@WebSocketServer()
	server: Server

	private streamingSessions = new Map<string, StreamingSession>()

	private readonly MAX_AUDIO_DURATION = 300000

	constructor(
		private readonly sttService: STTService,
		private readonly ttsService: TTSService,
		private readonly llmService: LlmService,
		private readonly conversationService: ConversationService,
		private readonly sessionService: SessionService
	) {}

	async handleConnection(client: Socket) {
		this.logger.log(`✓ Client connected: ${client.id}`)

		client.emit('connection', {
			status: 'connected',
			socketId: client.id,
			timestamp: Date.now()
		})
	}

	async handleDisconnect(client: Socket) {
		this.logger.log(`✓ Client disconnected: ${client.id}`)

		const sessions = Array.from(this.streamingSessions.entries())

		for (const [key, session] of sessions) {
			if (key.startsWith(client.id)) {
				this.streamingSessions.delete(key)

				this.logger.debug(`Cleaned up session: ${key}`)
			}
		}
	}

	@SubscribeMessage('start-stream')
	async handleStartStream(
		@ConnectedSocket() client: Socket,
		@MessageBody()
		data: {
			userId: string
			conversationId: string
			provider?: 'openai' | 'gemini'
		}
	) {
		try {
			const sessionKey = `${client.id}:${data.conversationId}`

			const session: StreamingSession = {
				userId: data.userId,
				conversationId: data.conversationId,
				audioChunks: [],
				isStreaming: true,
				startTime: Date.now(),
				provider: data.provider || 'openai',
				totalBytes: 0
			}

			this.streamingSessions.set(sessionKey, session)

			await this.sessionService.createSession(data.userId, data.conversationId)

			this.logger.log(`Stream started: ${sessionKey}`)

			client.emit('stream-started', {
				sessionKey,
				status: 'streaming',
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to start stream: ${(error as Error).message}`)
			client.emit('error', {
				code: 'STREAM_START_FAILED',
				message: `Failed to start stream: ${(error as Error).message}`
			})
		}
	}

	@SubscribeMessage('audio-chunk')
	async handleAudioChunk(
		@ConnectedSocket() client: Socket,
		@MessageBody()
		data: {
			sessionKey: string
			chunk: string
			isFinal: boolean
		}
	) {
		try {
			const session = this.streamingSessions.get(data.sessionKey)

			if (!session || !session.isStreaming) {
				client.emit('error', {
					code: 'STREAM_INACTIVE',
					message: 'Stream session not found or inactive'
				})
				return
			}

			const duration = Date.now() - session.startTime

			if (duration > this.MAX_AUDIO_DURATION) {
				session.isStreaming = false

				this.logger.warn(`Max duration exceeded: ${duration}ms`)

				client.emit('error', {
					code: 'DURATION_EXCEEDED',
					message: 'Recording duration exceeded (max 5 minutes)'
				})

				return
			}

			const audioBuffer = Buffer.from(data.chunk, 'base64')

			session.audioChunks.push(audioBuffer)
			session.totalBytes += audioBuffer.length

			this.logger.debug(`Chunk received: ${audioBuffer.length} bytes (total: ${session.totalBytes})`)

			client.emit('chunk-received', {
				bytesReceived: session.totalBytes,
				duration,
				timestamp: Date.now()
			})

			if (data.isFinal) {
				this.logger.log(`Final chunk received, processing audio...`)

				await this._processAudioStream(client, data.sessionKey, session)
			}
		} catch (error) {
			this.logger.error(`Failed to process audio chunk: ${(error as Error).message}`)

			client.emit('error', {
				code: 'CHUNK_PROCESS_FAILED',
				message: `Failed to process audio chunk: ${(error as Error).message}`
			})
		}
	}

	@SubscribeMessage('end-stream')
	async handleEndStream(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionKey: string }) {
		try {
			const session = this.streamingSessions.get(data.sessionKey)

			if (session) {
				session.isStreaming = false

				const duration = Date.now() - session.startTime

				this.logger.log(`Stream ended by user (duration: ${duration}ms)`)

				await this._processAudioStream(client, data.sessionKey, session)
			}

			client.emit('stream-ended', {
				status: 'processing',
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to end stream: ${(error as Error).message}`)

			client.emit('error', {
				code: 'STREAM_END_FAILED',
				message: `Failed to end stream: ${(error as Error).message}`
			})
		}
	}

	@SubscribeMessage('cancel-stream')
	async handleCancelStream(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionKey: string }) {
		try {
			const session = this.streamingSessions.get(data.sessionKey)

			if (session) {
				session.isStreaming = false
				session.audioChunks = []

				this.streamingSessions.delete(data.sessionKey)

				this.logger.log(`Stream cancelled by user`)

				await this.sessionService.deleteSession(session.userId, session.conversationId)
			}

			client.emit('stream-cancelled', {
				status: 'cancelled',
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to cancel stream: ${(error as Error).message}`)

			client.emit('error', {
				code: 'CANCEL_FAILED',
				message: `Failed to cancel stream: ${(error as Error).message}`
			})
		}
	}

	private async _processAudioStream(client: Socket, sessionKey: string, session: StreamingSession) {
		try {
			if (session.audioChunks.length === 0) {
				this.logger.warn('No audio data received')

				client.emit('error', {
					code: 'NO_AUDIO',
					message: 'No audio data received'
				})

				this.streamingSessions.delete(sessionKey)

				return
			}

			this.logger.log(`Processing ${session.audioChunks.length} chunks (${session.totalBytes} bytes)`)

			const fullAudioBuffer = Buffer.concat(session.audioChunks)

			this.logger.debug(`Audio concatenated: ${fullAudioBuffer.length} bytes`)

			await this.sessionService.updateSessionStatus(session.userId, session.conversationId, 'processing')

			client.emit('processing', {
				status: 'transcribing',
				timestamp: Date.now()
			})

			this.logger.log('Calling OpenAI Whisper STT...')

			let userMessage: string

			try {
				userMessage = await this.sttService.transcribeAudioFromBuffer(fullAudioBuffer)

				this.logger.log(`STT Success: "${userMessage}"`)
			} catch (sttError) {
				this.logger.error(`STT Failed: ${(sttError as Error).message}`)

				throw {
					code: 'STT_FAILED',
					message: `Speech recognition failed: ${(sttError as Error).message}`
				}
			}

			client.emit('transcription-complete', {
				userMessage,
				timestamp: Date.now()
			})

			this.logger.debug('Transcript sent to frontend')
			this.logger.log('Retrieving chat history...')

			const conversation = (await this.conversationService.getConversation(session.conversationId)) as any

			if (!conversation) {
				throw {
					code: 'CONVERSATION_NOT_FOUND',
					message: 'Conversation not found'
				}
			}

			const messages = conversation.messages.map((msg: any) => ({
				role: msg.role,
				content: msg.content
			}))

			messages.push({ role: 'user', content: userMessage })

			client.emit('processing', {
				status: 'generating-response',
				timestamp: Date.now()
			})

			this.logger.log(`Calling ${session.provider.toUpperCase()} API...`)

			let aiResponse: string

			try {
				const result = await this.llmService.generateResponse(messages, 'intermediate', session.provider)

				aiResponse = result.response

				this.logger.log(`AI Response: "${aiResponse.substring(0, 50)}..."`)
			} catch (llmError) {
				this.logger.error(`LLM Failed: ${(llmError as Error).message}`)

				throw {
					code: 'LLM_FAILED',
					message: `Failed to generate response: ${(llmError as Error).message}`
				}
			}

			client.emit('response-generated', {
				aiResponse,
				timestamp: Date.now()
			})

			client.emit('processing', {
				status: 'generating-audio',
				timestamp: Date.now()
			})

			this.logger.log('Calling OpenAI TTS API...')

			let audioResponseUrl: string | undefined

			try {
				const uploadDir = process.env.UPLOAD_DIR || './uploads'

				audioResponseUrl = await this.ttsService.generateSpeechAndSave(aiResponse, uploadDir)

				this.logger.log(`Audio generated: ${audioResponseUrl}`)
			} catch (ttsError) {
				this.logger.error(`TTS Failed: ${(ttsError as Error).message}`)
				this.logger.warn('Falling back to text-only response')

				audioResponseUrl = undefined
			}

			this.logger.log('Saving to database...')

			try {
				await this.conversationService.addMessage(session.conversationId, 'user', userMessage)

				await this.conversationService.addMessage(
					session.conversationId,
					'assistant',
					aiResponse,
					undefined,
					audioResponseUrl,
					session.provider
				)

				this.logger.debug('Messages saved to database')
			} catch (dbError) {
				this.logger.error(`Database save failed: ${(dbError as Error).message}`)
			}

			await this.sessionService.updateSessionStatus(session.userId, session.conversationId, 'active')

			client.emit('response-complete', {
				userMessage,
				aiResponse,
				audioUrl: audioResponseUrl,
				provider: session.provider,
				timestamp: Date.now()
			})

			this.logger.log(`Response sent to frontend`)

			this.streamingSessions.delete(sessionKey)
		} catch (error) {
			this.logger.error(`${(error as Error as any)?.code || 'UNKNOWN'}: ${(error as Error).message}`)

			try {
				await this.sessionService.updateSessionStatus(session.userId, session.conversationId, 'idle')
			} catch (e) {
				this.logger.error(`Failed to update session status: ${(e as Error).message}`)
			}

			client.emit('error', {
				code: (error as Error as any).code || 'PROCESSING_FAILED',
				message: (error as Error as any).message || 'Failed to process audio stream',
				timestamp: Date.now()
			})

			this.streamingSessions.delete(sessionKey)
		}
	}

	@SubscribeMessage('get-session-info')
	async handleGetSessionInfo(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionKey: string }) {
		try {
			const session = this.streamingSessions.get(data.sessionKey)

			if (!session) {
				client.emit('error', {
					code: 'SESSION_NOT_FOUND',
					message: 'Session not found'
				})

				return
			}

			client.emit('session-info', {
				sessionKey: data.sessionKey,
				userId: session.userId,
				conversationId: session.conversationId,
				isStreaming: session.isStreaming,
				audioSize: session.totalBytes,
				duration: Date.now() - session.startTime,
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to get session info: ${(error as Error).message}`)

			client.emit('error', {
				code: 'SESSION_INFO_FAILED',
				message: `Failed to get session info: ${(error as Error).message}`
			})
		}
	}
}
