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
import { EVENTS } from '../commons/constants'
import { AudioChunk, EndStream, StartStream } from '../commons/interfaces/message-body.interface'
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'
import { STTService } from '../services/speech-to-text.service'
import { TTSService } from '../services/text-to-speech.service'
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
	private readonly processors = new Map<string, { processing: boolean; promise: Promise<void> | null }>()

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
		const clientID = client.id

		this.logger.log(`[${clientID}] Client connected`)

		client.emit('connection', {
			status: 'connected',
			socketId: clientID,
			timestamp: Date.now()
		})
	}

	async handleDisconnect(client: Socket) {
		const clientID = client.id

		this.logger.log(`[${clientID}] Client disconnected`)

		const processor = this.processors.get(clientID)

		if (processor?.processing) {
			this.logger.warn(`Client disconnected while processing: ${clientID}`)
		}

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

		this.processors.delete(clientID)
	}

	@SubscribeMessage(EVENTS.START_STREAM)
	async handleStartStream(@ConnectedSocket() client: Socket, @MessageBody() mb: StartStream) {
		const clientID = client.id

		try {
			await this.audioService.createAudioSession(clientID, mb.sessionId, mb.conversationId)

			this.logger.log(`[${clientID}] Stream started: ${mb.userId} / ${mb.conversationId}`)

			client.emit('stream-started', {
				sessionKey: clientID,
				status: 'streaming',
				timestamp: Date.now()
			})
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to start stream: ${e.message}`)

			client.emit('error', {
				code: 'STREAM_START_FAILED',
				message: e.message
			})
		}
	}

	@SubscribeMessage(EVENTS.AUDIO_CHUNK)
	async handleAudioChunk(@ConnectedSocket() client: Socket, @MessageBody() mb: AudioChunk) {
		const clientID = client.id

		try {
			const { chunk, chunkIndex, isFinal } = mb
			const audio = await this.audioService.addAudioChunk(clientID, chunk, chunkIndex)

			client.emit('chunk-received', {
				chunkIndex: chunkIndex,
				bytesReceived: audio.totalBytes,
				duration: Date.now() - audio.startTime,
				timestamp: Date.now()
			})

			if (isFinal) {
				this.logger.log(`[${clientID}] Step 6: Final chunk received, preparing to process...`)
			}
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to process chunk: ${e.message}`)

			client.emit('error', {
				code: 'CHUNK_FAILED',
				message: e.message
			})
		}
	}

	@SubscribeMessage(EVENTS.END_STREAM)
	async handleEndStream(@ConnectedSocket() client: Socket, @MessageBody() mb: EndStream) {
		const clientID = client.id
		const streamType = mb?.streamType || 'sentence'

		try {
			const processor = this.processors.get(clientID)

			if (processor?.processing) {
				this.logger.log(`[${clientID}] Skip stream already being processed`)

				if (processor.promise) {
					await processor.promise
				}

				return
			}

			this.logger.log(`[${clientID}] Step 6: End stream signal received, starting processing...`)

			let resolveProcessor: () => void

			const promise = new Promise<void>((resolve) => {
				resolveProcessor = resolve
			})

			this.processors.set(clientID, { processing: true, promise })

			this.logger.log(`[${clientID}] DEBUG-BEFORE: About to process audio...`)

			try {
				await this.processing(client)

				this.logger.log(`[${clientID}] COMPLETE: Audio processing finished`)
			} finally {
				this.logger.log(`[${clientID}] DEBUG-FINALLY: In finally block, resolving promise...`)

				this.processors.set(clientID, { processing: false, promise: null })

				this.logger.log(`[${clientID}] DEBUG-FINALLY: About to call resolveProcessor()...`)

				resolveProcessor!()

				this.logger.log(`[${clientID}] DEBUG-FINALLY: resolveProcessor() called`)
			}

			this.logger.log(`[${clientID}] DEBUG-AFTER-FINALLY: After finally block`)
			this.logger.log(`[${clientID}] DEBUG: handleEndStream COMPLETED - session remains active`)
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to end stream: ${e.message}`)

			this.processors.set(clientID, { processing: false, promise: null })

			client.emit('error', { code: 'STREAM_END_FAILED', message: e.message })
		}
	}

	@SubscribeMessage(EVENTS.CANCEL_STREAM)
	async handleCancelStream(@ConnectedSocket() client: Socket, @MessageBody() data: { sessionId: string }) {
		const clientID = client.id

		try {
			this.logger.log(`[${clientID}] Stream cancelled`)

			await this.audioService.clearAudioSession(client.id)

			this.processors.delete(client.id)

			client.emit('stream-cancelled', { status: 'cancelled', timestamp: Date.now() })
		} catch (e) {
			this.logger.error(`[${clientID}] Failed to cancel stream: ${e.message}`)

			client.emit('error', { code: 'CANCEL_FAILED', message: e.message })
		}
	}

	@SubscribeMessage(EVENTS.END_CONVERSATION)
	async handleEndConversation(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
		try {
			this.logger.log(`[Step 25] End conversation signal received`)

			await this.cacheService.setSessionState(client.id, {
				isClosed: true,
				closedAt: Date.now()
			})

			await this.cacheService.clearClientCaches(client.id)
			await this.audioService.clearAudioSession(client.id)

			this.processors.delete(client.id)

			this.logger.debug(`[Cleanup] Session closed: ${client.id}`)

			client.emit('conversation-ended', {
				status: 'closed',
				message: 'Conversation session closed',
				timestamp: Date.now()
			})
		} catch (e) {
			this.logger.error(`Failed to end conversation: ${e.message}`)

			client.emit('error', {
				code: 'CONVERSATION_END_FAILED',
				message: e.message
			})
		}
	}

	private async processing(client: Socket) {
		const startTime = Date.now()
		const clientID = client.id

		try {
			this.logger.log(`[${clientID}] Step 10: Concatenating audio chunks...`)

			const fullAudioBuffer = await this.audioService.concatenateAudio(clientID)

			client.emit('processing', {
				status: 'transcribing',
				timestamp: Date.now()
			})

			this.logger.log(`[${clientID}] Step 11: Calling STT...`)

			let transcript: string

			try {
				transcript = await this.sttService.transcribeAudioWithGemini(fullAudioBuffer)

				this.logger.log(`[${clientID}] Step 11: STT Success: "${transcript}"`)

				await this.cacheService.setUserTranscript(clientID, transcript)
			} catch (e) {
				this.logger.error(`[${clientID}] Step 11: STT Failed: ${e.message}`)

				throw {
					code: 'STT_FAILED',
					message: `Could not understand audio`
				}
			}

			client.emit('user-transcript', {
				text: transcript,
				timestamp: Date.now()
			})

			client.emit('processing', {
				status: 'generating-response',
				timestamp: Date.now()
			})

			const conversationId = `temp-conv-${clientID}`

			this.logger.log(`[${clientID}] Step 12: Retrieving chat history...`)

			let messages = (await this.cacheService.getChatHistory(conversationId)) as any

			if (!messages) {
				messages = []
			}

			messages.push({ role: 'user', content: transcript })

			this.logger.log(`[${clientID}] Step 13: Calling Gemini API...`)

			let aiResponse: string

			try {
				const result = await this.llmService.generateResponse(messages, 'intermediate', 'gemini')

				aiResponse = result.response

				this.logger.log(`[${clientID}] Step 14: AI Response: "${aiResponse.substring(0, 50)}..."`)

				await this.cacheService.setAIResponse(clientID, aiResponse)
			} catch (e) {
				this.logger.error(`[${clientID}] Step 14: Gemini API Failed: ${e.message}`)

				throw {
					code: 'LLM_FAILED',
					message: `Failed to generate response`
				}
			}

			client.emit('ai-response', { text: aiResponse, timestamp: Date.now() })

			client.emit('processing', { status: 'generating-audio', timestamp: Date.now() })

			this.logger.log(`[${clientID}] Step 16: Calling TTS API...`)

			let audioUrl: string | undefined
			let wordTimings: any[] = []

			try {
				const uploadDir = process.env.UPLOAD_DIR || './uploads'
				const ttsResult = await this.ttsService.synthesizeWithTimings(aiResponse, uploadDir)

				audioUrl = ttsResult.audioUrl
				wordTimings = ttsResult.wordTimings

				await this.cacheService.setWordTimings(clientID, wordTimings)

				this.logger.log(`[${clientID}] Step 18: Audio generated: ${ttsResult.duration}ms, ${wordTimings.length} words`)
			} catch (e) {
				this.logger.warn(`[${clientID}] Step 16: TTS Failed: ${e.message}`)

				audioUrl = undefined
				wordTimings = []
			}

			this.logger.log(`[${clientID}] Step 20: Saving to cache...`)

			messages.push({ role: 'assistant', content: aiResponse })

			await this.cacheService.setChatHistory(conversationId, messages)

			const processingTime = Date.now() - startTime

			this.logger.log(`[Complete] Response sent in ${processingTime}ms`)
			this.logger.log(`[DEBUG] About to emit response-complete...`)

			client.emit('response-complete', {
				userTranscript: transcript,
				aiResponse,
				audioUrl,
				wordTimings,
				processingTime,
				timestamp: Date.now()
			})

			this.logger.log(`[DEBUG] response-complete EMITTED`)
			this.logger.log(`[DEBUG] Setting session state...`)

			await this.cacheService.setSessionState(clientID, {
				lastExchange: Date.now(),
				userTranscript: transcript,
				aiResponse,
				audioUrl,
				isClosed: false
			})

			this.logger.log(`[DEBUG] Session state SET`)
			this.logger.log(`[DEBUG] processing COMPLETED`)
		} catch (e) {
			this.logger.error(`[Error] ${e.code}: ${e.message}`)

			this.logger.log(`[DEBUG] Emitting error event...`)

			client.emit('error', {
				code: e.code || 'PROCESSING_FAILED',
				message: e.message,
				timestamp: Date.now()
			})

			this.logger.log(`[DEBUG] Error event emitted`)

			await this.audioService.clearAudioSession(clientID)
		}
	}
}
