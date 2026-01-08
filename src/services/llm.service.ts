import { GoogleGenAI, LiveServerMessage } from '@google/genai'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LiveAPIConfig, LiveSession } from '../commons/interfaces/live-api.interface'

@Injectable()
export class LlmService {
	private readonly logger = new Logger(LlmService.name)
	private readonly googleai: GoogleGenAI
	private readonly liveSessions: Map<string, LiveSession> = new Map()

	constructor(private readonly configService: ConfigService) {
		const googleApiKey =
			(this.configService.get<string>('GOOGLE_GEMINI_API_KEY') as string) ?? process.env.GOOGLE_GEMINI_API_KEY

		if (!googleApiKey) {
			throw new Error('GOOGLE_GEMINI_API_KEY is not set')
		}

		this.googleai = new GoogleGenAI({ apiKey: googleApiKey })
	}

	async createLiveSession(
		clientId: string,
		config: LiveAPIConfig,
		handleMessage: (message: LiveServerMessage) => void,
		handleError?: (error: Error) => void,
		handleClose?: (reason: string) => void
	): Promise<LiveSession> {
		try {
			this.logger.log(`[${clientId}] Creating Live API session...`)

			const session = await this.googleai.live.connect({
				model: config.model,
				config: {
					responseModalities: config.responseModalities as any,
					systemInstruction: config.systemInstruction,
					inputAudioTranscription: config.inputAudioTranscription,
					outputAudioTranscription: config.outputAudioTranscription
				},
				callbacks: {
					onopen: () => {
						this.logger.log(`[${clientId}] Live API session connected`)
					},
					onmessage: (message: any) => {
						if (handleMessage) {
							handleMessage(message as LiveServerMessage)
						}
					},
					onerror: (error: any) => {
						this.logger.error(`[${clientId}] Live API error: ${error.message}`)

						if (handleError) {
							handleError(error)
						}
					},
					onclose: (event: any) => {
						this.logger.log(`[${clientId}] Live API session closed: ${event.reason}`)

						if (handleClose) {
							handleClose(event.reason)
						}
					}
				}
			})

			const liveSession: LiveSession = {
				clientId,
				session,
				audioQueue: [],
				conversationHistory: [],
				createdAt: Date.now(),
				isActive: true
			}

			this.liveSessions.set(clientId, liveSession)

			this.logger.log(`[${clientId}] Live API session created successfully`)

			return liveSession
		} catch (error) {
			this.logger.error(`[${clientId}] Failed to create Live API session: ${(error as Error).message}`)

			throw new Error(`Live API session creation failed: ${(error as Error).message}`)
		}
	}

	async sendRealtimeAudio(clientId: string, audioChunk: Buffer): Promise<void> {
		const liveSession = this.liveSessions.get(clientId)

		if (!liveSession || !liveSession.isActive) {
			throw new Error('Live API session not found or inactive')
		}

		try {
			const base64Audio = audioChunk.toString('base64')

			if (!liveSession.audioQueue) {
				liveSession.audioQueue = []
			}

			liveSession.audioQueue.push(audioChunk)

			if (liveSession.audioQueue.length <= 3) {
				this.logger.debug(`[${clientId}] Sending chunk #${liveSession.audioQueue.length}: ${audioChunk.length} bytes`)
			}

			await liveSession.session.sendRealtimeInput({
				audio: {
					data: base64Audio,
					mimeType: 'audio/pcm;rate=16000'
				}
			})
		} catch (error) {
			this.logger.error(`[${clientId}] Failed to send audio: ${(error as Error).message}`)

			throw error
		}
	}

	async closeLiveSession(clientId: string): Promise<void> {
		const liveSession = this.liveSessions.get(clientId)

		if (!liveSession) {
			this.logger.warn(`[${clientId}] No Live API session to close`)

			return
		}

		try {
			liveSession.isActive = false

			this.liveSessions.delete(clientId)

			this.logger.log(`[${clientId}] Live API session closed and cleaned up`)
		} catch (error) {
			this.logger.error(`[${clientId}] Error closing Live API session: ${(error as Error).message}`)
		}
	}

	getLiveSession(clientId: string): LiveSession | undefined {
		return this.liveSessions.get(clientId)
	}
}
