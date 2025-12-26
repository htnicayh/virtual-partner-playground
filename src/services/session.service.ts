import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable } from '@nestjs/common'
import { Redis } from 'ioredis'

interface VoiceSession {
	userId: string
	conversationId: string
	status: 'active' | 'idle' | 'processing'
	lastActivityAt: string
	createdAt: string
}

@Injectable()
export class SessionService {
	private readonly SESSION_KEY_PREFIX = 'voice_session:'
	private readonly SESSION_EXPIRY = 3600 // 1 hour

	private readonly redisClient: Redis

	constructor(private readonly redisService: RedisService) {
		this.redisClient = this.redisService.getClient()
	}

	async createSession(userId: string, conversationId: string): Promise<VoiceSession> {
		const sessionId = `${this.SESSION_KEY_PREFIX}${userId}:${conversationId}`
		const now = new Date().toISOString()

		const session: VoiceSession = {
			userId,
			conversationId,
			status: 'active',
			lastActivityAt: now,
			createdAt: now
		}

		await this.redisClient.setex(sessionId, this.SESSION_EXPIRY, JSON.stringify(session))

		return session
	}

	async getSession(userId: string, conversationId: string): Promise<VoiceSession | null> {
		const sessionId = `${this.SESSION_KEY_PREFIX}${userId}:${conversationId}`
		const data = await this.redisClient.get(sessionId)

		if (!data) {
			return null
		}

		return JSON.parse(data)
	}

	async updateSessionStatus(
		userId: string,
		conversationId: string,
		status: 'active' | 'idle' | 'processing'
	): Promise<VoiceSession> {
		const sessionId = `${this.SESSION_KEY_PREFIX}${userId}:${conversationId}`
		const session = await this.getSession(userId, conversationId)

		if (!session) {
			throw new Error('Session not found')
		}

		const updatedSession: VoiceSession = {
			...session,
			status,
			lastActivityAt: new Date().toISOString()
		}

		await this.redisClient.setex(sessionId, this.SESSION_EXPIRY, JSON.stringify(updatedSession))

		return updatedSession
	}

	async deleteSession(userId: string, conversationId: string): Promise<void> {
		const sessionId = `${this.SESSION_KEY_PREFIX}${userId}:${conversationId}`

		await this.redisClient.del(sessionId)
	}

	async getUserActiveSessions(userId: string): Promise<VoiceSession[]> {
		const pattern = `${this.SESSION_KEY_PREFIX}${userId}:*`
		const keys = await this.redisClient.keys(pattern)

		const sessions: VoiceSession[] = []

		for (const key of keys) {
			const data = await this.redisClient.get(key)

			if (data) {
				sessions.push(JSON.parse(data))
			}
		}

		return sessions
	}

	async extendSessionExpiry(userId: string, conversationId: string): Promise<void> {
		const sessionId = `${this.SESSION_KEY_PREFIX}${userId}:${conversationId}`

		await this.redisClient.expire(sessionId, this.SESSION_EXPIRY)
	}
}
