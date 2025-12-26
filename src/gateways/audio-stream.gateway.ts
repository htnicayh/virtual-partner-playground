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
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'
import { STTService } from '../services/speech-to-text.service'
import { TTSService } from '../services/text-to-speech.service'

@WebSocketGateway({
	cors: {
		origin: process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
		credentials: true
	},
	namespace: '/audio'
})
@Injectable()
export class AudioStreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger(AudioStreamGateway.name)

	@WebSocketServer()
	server: Server

	constructor(
		private readonly audioService: AudioService,
		private readonly cacheService: CacheService,
		private readonly sttService: STTService,
		private readonly ttsService: TTSService,
		private readonly llmService: LlmService
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

		await this.cacheService.clearClientCaches(client.id)
		await this.audioService.clearAudioSession(client.id)

		this.logger.debug(`[Cleanup] Session cleaned up: ${client.id}`)
	}

	@SubscribeMessage('start-stream')
	async handleStartStream(
		@ConnectedSocket() client: Socket,
		@MessageBody()
		data: {
			userId: string
			conversationId: string
			sessionId: string
			provider?: 'openai' | 'gemini'
		}
	) {
		try {
			const audioSession = await this.audioService.createAudioSession(client.id, data.sessionId, data.conversationId)

			this.logger.log(`[Step 1] Stream started: ${data.userId} / ${data.conversationId}`)

			client.emit('stream-started', {
				sessionKey: client.id,
				status: 'streaming',
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to start stream: ${error.message}`)

			client.emit('error', {
				code: 'STREAM_START_FAILED',
				message: error.message
			})
		}
	}

	@SubscribeMessage('audio-chunk')
	async handleAudioChunk(
		@ConnectedSocket() client: Socket,
		@MessageBody()
		data: {
			chunk: string
			chunkIndex: number
			isFinal: boolean
		}
	) {
		try {
			const audioSession = await this.audioService.addAudioChunk(client.id, data.chunk, data.chunkIndex)

			client.emit('chunk-received', {
				chunkIndex: data.chunkIndex,
				bytesReceived: audioSession.totalBytes,
				duration: Date.now() - audioSession.startTime,
				timestamp: Date.now()
			})

			if (data.isFinal) {
				this.logger.log(`[Step 6] Final chunk received, processing...`)

				await this._processAudioStream(client, client.id)
			}
		} catch (error) {
			this.logger.error(`Failed to process chunk: ${error.message}`)

			client.emit('error', {
				code: 'CHUNK_FAILED',
				message: error.message
			})
		}
	}

	@SubscribeMessage('end-stream')
	async handleEndStream(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
		try {
			this.logger.log(`[Step 6] Stream end signal received`)

			const audioFilePath = await this.audioService.saveAudioToFile(client.id)

			await this._processAudioStream(client, client.id)

			client.emit('stream-ended', {
				status: 'processing',
				audioFile: audioFilePath,
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to end stream: ${error.message}`)

			client.emit('error', {
				code: 'STREAM_END_FAILED',
				message: error.message
			})
		}
	}

	@SubscribeMessage('cancel-stream')
	async handleCancelStream(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
		try {
			await this.audioService.clearAudioSession(client.id)
			await this.cacheService.clearClientCaches(client.id)

			this.logger.log(`[Cleanup] Stream cancelled: ${client.id}`)

			client.emit('stream-cancelled', {
				status: 'cancelled',
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to cancel stream: ${error.message}`)

			client.emit('error', {
				code: 'CANCEL_FAILED',
				message: error.message
			})
		}
	}

	private async _processAudioStream(client: Socket, clientId: string) {
		const startTime = Date.now()

		try {
			this.logger.log(`[Step 10] Concatenating audio chunks...`)

			const fullAudioBuffer = await this.audioService.concatenateAudio(clientId)

			client.emit('processing', {
				status: 'transcribing',
				timestamp: Date.now()
			})

			this.logger.log(`[Step 11] Calling Whisper STT...`)

			let userTranscript: string

			try {
				userTranscript = await this.sttService.transcribeAudioWithGemini(fullAudioBuffer)

				this.logger.log(`[Step 11] STT Success: "${userTranscript}"`)

				await this.cacheService.setUserTranscript(clientId, userTranscript)
			} catch (sttError) {
				this.logger.error(`[Step 11] STT Failed: ${sttError.message}`)

				throw {
					code: 'STT_FAILED',
					message: `Could not understand audio`
				}
			}

			client.emit('user-transcript', {
				text: userTranscript,
				timestamp: Date.now()
			})

			client.emit('processing', {
				status: 'generating-response',
				timestamp: Date.now()
			})

			const conversationId = `temp-conv-${clientId}`

			this.logger.log(`[Step 12] Retrieving chat history...`)

			let messages = (await this.cacheService.getChatHistory(conversationId)) as any

			if (!messages) {
				messages = []
			}

			messages.push({
				role: 'user',
				content: userTranscript
			})

			this.logger.log(`[Step 13] Calling Gemini API...`)

			let aiResponse: string

			try {
				const result = await this.llmService.generateResponse(messages, 'intermediate', 'gemini')

				aiResponse = result.response

				this.logger.log(`[Step 14] AI Response: "${aiResponse.substring(0, 50)}..."`)

				await this.cacheService.setAIResponse(clientId, aiResponse)
			} catch (llmError) {
				this.logger.error(`[Step 14] Gemini API Failed: ${llmError.message}`)

				throw {
					code: 'LLM_FAILED',
					message: `Failed to generate response`
				}
			}

			client.emit('ai-response', {
				text: aiResponse,
				timestamp: Date.now()
			})

			client.emit('processing', {
				status: 'generating-audio',
				timestamp: Date.now()
			})

			this.logger.log(`[Step 16] Calling TTS API...`)

			let audioUrl: string | undefined
			let wordTimings: any[] = []

			try {
				const uploadDir = process.env.UPLOAD_DIR || './uploads'

				const ttsResult = await this.ttsService.synthesizeWithTimings(aiResponse, uploadDir)

				audioUrl = ttsResult.audioUrl
				wordTimings = ttsResult.wordTimings

				await this.cacheService.setWordTimings(clientId, wordTimings)

				this.logger.log(`[Step 18] Audio generated: ${ttsResult.duration}ms, ${wordTimings.length} words`)
			} catch (ttsError) {
				this.logger.warn(`[Step 16] TTS Failed: ${ttsError.message}`)

				audioUrl = undefined
				wordTimings = []
			}

			this.logger.log(`[Step 20] Saving to cache...`)

			messages.push({
				role: 'assistant',
				content: aiResponse
			})

			await this.cacheService.setChatHistory(conversationId, messages)

			const processingTime = Date.now() - startTime

			this.logger.log(`[Complete] Response sent in ${processingTime}ms`)

			client.emit('response-complete', {
				userTranscript,
				aiResponse,
				audioUrl,
				wordTimings,
				processingTime,
				timestamp: Date.now()
			})

			await this.cacheService.setSessionState(clientId, {
				lastExchange: Date.now(),
				userTranscript,
				aiResponse,
				audioUrl
			})
		} catch (error) {
			this.logger.error(`[Error] ${error.code}: ${error.message}`)

			client.emit('error', {
				code: error.code || 'PROCESSING_FAILED',
				message: error.message,
				timestamp: Date.now()
			})

			await this.audioService.clearAudioSession(clientId)
		}
	}

	@SubscribeMessage('get-session-info')
	async handleGetSessionInfo(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
		try {
			const audioSession = await this.audioService.getAudioSession(client.id)
			const sessionState = await this.cacheService.getSessionState(client.id)

			client.emit('session-info', {
				audioSession,
				sessionState,
				timestamp: Date.now()
			})
		} catch (error) {
			this.logger.error(`Failed to get session info: ${error.message}`)
			client.emit('error', {
				code: 'SESSION_INFO_FAILED',
				message: error.message
			})
		}
	}
}
