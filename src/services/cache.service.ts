import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { WordTiming } from '../commons/interfaces/word-timing.interface'

@Injectable()
export class CacheService {
	private readonly logger = new Logger(CacheService.name)

	private readonly TRANSCRIPT_USER_PREFIX = 'transcript:user:'
	private readonly RESPONSE_AI_PREFIX = 'response:ai:'
	private readonly WORD_TIMINGS_PREFIX = 'wordTimings:'
	private readonly CHAT_HISTORY_PREFIX = 'history:'
	private readonly SESSION_PREFIX = 'session:'

	private readonly TRANSCRIPT_TTL = 600
	private readonly RESPONSE_TTL = 600
	private readonly HISTORY_TTL = 1800
	private readonly SESSION_TTL = 3600

	private readonly redisClient: Redis

	constructor(private readonly redisService: RedisService) {
		this.redisClient = this.redisService.getClient()
	}

	async setUserTranscript(clientId: string, transcript: string, confidence: number = 0.95): Promise<void> {
		const key = `${this.TRANSCRIPT_USER_PREFIX}${clientId}`

		const data = JSON.stringify({ transcript, confidence })

		await this.redisClient.setex(key, this.TRANSCRIPT_TTL, data)

		this.logger.debug(`User transcript cached: "${transcript.substring(0, 30)}..."`)
	}

	async getUserTranscript(clientId: string): Promise<string | null> {
		const key = `${this.TRANSCRIPT_USER_PREFIX}${clientId}`

		const data = await this.redisClient.get(key)

		if (!data) {
			return null
		}

		const parsed = JSON.parse(data)

		return parsed.transcript
	}

	async setAIResponse(clientId: string, response: string, tokenCount: number = 0): Promise<void> {
		const key = `${this.RESPONSE_AI_PREFIX}${clientId}`

		const data = JSON.stringify({ response, tokenCount })

		await this.redisClient.setex(key, this.RESPONSE_TTL, data)

		this.logger.debug(`AI response cached: "${response.substring(0, 30)}..."`)
	}

	async getAIResponse(clientId: string): Promise<string | null> {
		const key = `${this.RESPONSE_AI_PREFIX}${clientId}`

		const data = await this.redisClient.get(key)

		if (!data) {
			return null
		}

		const parsed = JSON.parse(data)

		return parsed.response
	}

	async setWordTimings(clientId: string, wordTimings: WordTiming[]): Promise<void> {
		const key = `${this.WORD_TIMINGS_PREFIX}${clientId}`

		const data = JSON.stringify(wordTimings)

		await this.redisClient.setex(key, this.RESPONSE_TTL, data)

		this.logger.debug(`Word timings cached: ${wordTimings.length} words`)
	}

	async getWordTimings(clientId: string): Promise<WordTiming[] | null> {
		const key = `${this.WORD_TIMINGS_PREFIX}${clientId}`

		const data = await this.redisClient.get(key)

		if (!data) {
			return null
		}

		return JSON.parse(data)
	}

	async setChatHistory(conversationId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
		const key = `${this.CHAT_HISTORY_PREFIX}${conversationId}`

		const data = JSON.stringify(messages)

		await this.redisClient.setex(key, this.HISTORY_TTL, data)

		this.logger.debug(`Chat history cached: ${messages.length} messages`)
	}

	async getChatHistory(conversationId: string): Promise<Array<{ role: string; content: string }> | null> {
		const key = `${this.CHAT_HISTORY_PREFIX}${conversationId}`

		const data = await this.redisClient.get(key)

		if (!data) {
			this.logger.debug(`Chat history cache miss for: ${conversationId}`)

			return null
		}

		this.logger.debug(`Chat history cache hit for: ${conversationId}`)

		return JSON.parse(data)
	}

	async invalidateChatHistory(conversationId: string): Promise<void> {
		const key = `${this.CHAT_HISTORY_PREFIX}${conversationId}`

		await this.redisClient.del(key)

		this.logger.debug(`Chat history cache invalidated: ${conversationId}`)
	}

	async setSessionState(clientId: string, sessionState: Record<string, any>): Promise<void> {
		const key = `${this.SESSION_PREFIX}${clientId}`

		const data = JSON.stringify(sessionState)

		await this.redisClient.setex(key, this.SESSION_TTL, data)

		this.logger.debug(`Session state cached: ${clientId}`)
	}

	async getSessionState(clientId: string): Promise<Record<string, any> | null> {
		const key = `${this.SESSION_PREFIX}${clientId}`

		const data = await this.redisClient.get(key)

		if (!data) {
			return null
		}

		return JSON.parse(data)
	}

	async clearClientCaches(clientId: string): Promise<void> {
		await Promise.all([
			this.redisClient.del(`${this.TRANSCRIPT_USER_PREFIX}${clientId}`),
			this.redisClient.del(`${this.RESPONSE_AI_PREFIX}${clientId}`),
			this.redisClient.del(`${this.WORD_TIMINGS_PREFIX}${clientId}`),
			this.redisClient.del(`${this.SESSION_PREFIX}${clientId}`)
		])

		this.logger.debug(`Client caches cleared: ${clientId}`)
	}
}
