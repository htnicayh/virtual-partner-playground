import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import { WordTiming } from '../commons/interfaces/word-timing.interface'

@Injectable()
export class CacheService {
	private readonly logger = new Logger(CacheService.name)

	private readonly TRANSCRIPT_USER_PREFIX = 'transcript:user:'
	private readonly RESPONSE_AI_PREFIX = 'response:ai:'
	private readonly AUDIO_CHUNKS_PREFIX = 'audio:ai:'
	private readonly WORD_TIMINGS_PREFIX = 'wordTimings:'
	private readonly CHAT_HISTORY_PREFIX = 'history:'
	private readonly SESSION_PREFIX = 'session:'

	private readonly TRANSCRIPT_TTL = 600
	private readonly RESPONSE_TTL = 600
	private readonly AUDIO_TTL = 600
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
	}

	async getUserTranscript(clientId: string): Promise<string | null> {
		const key = `${this.TRANSCRIPT_USER_PREFIX}${clientId}`
		const data = await this.redisClient.get(key)
		if (!data) return null
		return JSON.parse(data).transcript
	}

	async setAIResponse(clientId: string, response: string, tokenCount: number = 0): Promise<void> {
		const key = `${this.RESPONSE_AI_PREFIX}${clientId}`
		const data = JSON.stringify({ response, tokenCount })
		await this.redisClient.setex(key, this.RESPONSE_TTL, data)
	}

	async getAIResponse(clientId: string): Promise<string | null> {
		const key = `${this.RESPONSE_AI_PREFIX}${clientId}`
		const data = await this.redisClient.get(key)
		if (!data) return null
		return JSON.parse(data).response
	}

	async appendAIAudioChunk(clientId: string, base64Chunk: string): Promise<void> {
		const key = `${this.AUDIO_CHUNKS_PREFIX}${clientId}`
		await this.redisClient.rpush(key, base64Chunk)
		await this.redisClient.expire(key, this.AUDIO_TTL)
	}

	async getAIAudioChunks(clientId: string): Promise<string[]> {
		const key = `${this.AUDIO_CHUNKS_PREFIX}${clientId}`
		const chunks = await this.redisClient.lrange(key, 0, -1)
		return chunks
	}

	async clearAIAudioChunks(clientId: string): Promise<void> {
		const key = `${this.AUDIO_CHUNKS_PREFIX}${clientId}`
		await this.redisClient.del(key)
	}

	async setWordTimings(clientId: string, wordTimings: WordTiming[]): Promise<void> {
		const key = `${this.WORD_TIMINGS_PREFIX}${clientId}`
		const data = JSON.stringify(wordTimings)
		await this.redisClient.setex(key, this.RESPONSE_TTL, data)
	}

	async getWordTimings(clientId: string): Promise<WordTiming[] | null> {
		const key = `${this.WORD_TIMINGS_PREFIX}${clientId}`
		const data = await this.redisClient.get(key)
		if (!data) return null
		return JSON.parse(data)
	}

	async setChatHistory(conversationId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
		const key = `${this.CHAT_HISTORY_PREFIX}${conversationId}`
		const data = JSON.stringify(messages)
		await this.redisClient.setex(key, this.HISTORY_TTL, data)
	}

	async getChatHistory(conversationId: string): Promise<Array<{ role: string; content: string }> | null> {
		const key = `${this.CHAT_HISTORY_PREFIX}${conversationId}`
		const data = await this.redisClient.get(key)
		if (!data) return null
		return JSON.parse(data)
	}

	async invalidateChatHistory(conversationId: string): Promise<void> {
		const key = `${this.CHAT_HISTORY_PREFIX}${conversationId}`
		await this.redisClient.del(key)
	}

	async setSessionState(clientId: string, sessionState: Record<string, any>): Promise<void> {
		const key = `${this.SESSION_PREFIX}${clientId}`
		const data = JSON.stringify(sessionState)
		await this.redisClient.setex(key, this.SESSION_TTL, data)
	}

	async getSessionState(clientId: string): Promise<Record<string, any> | null> {
		const key = `${this.SESSION_PREFIX}${clientId}`
		const data = await this.redisClient.get(key)
		if (!data) return null
		return JSON.parse(data)
	}

	async clearClientCaches(clientId: string): Promise<void> {
		const keys = [
			`${this.TRANSCRIPT_USER_PREFIX}${clientId}`,
			`${this.RESPONSE_AI_PREFIX}${clientId}`,
			`${this.AUDIO_CHUNKS_PREFIX}${clientId}`,
			`${this.WORD_TIMINGS_PREFIX}${clientId}`,
			`${this.SESSION_PREFIX}${clientId}`
		]
		if (keys.length > 0) {
			await this.redisClient.del(keys)
		}
	}
}
