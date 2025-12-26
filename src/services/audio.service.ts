import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import * as fs from 'fs'
import * as path from 'path'
import { AudioSession } from '../commons/interfaces/audio-session.interface'

@Injectable()
export class AudioService {
	private readonly logger = new Logger(AudioService.name)
	private readonly AUDIO_SESSION_PREFIX = 'audio:session:'
	private readonly SESSION_TTL = 3600

	private readonly redisClient: Redis

	constructor(private readonly redisService: RedisService) {
		this.redisClient = this.redisService.getClient()
	}

	async createAudioSession(clientId: string, sessionId: string, conversationId: string): Promise<AudioSession> {
		const audioSession: AudioSession = {
			clientId,
			sessionId,
			conversationId,
			audioChunks: [],
			totalChunksReceived: 0,
			totalBytes: 0,
			lastChunkReceivedAt: Date.now(),
			startTime: Date.now(),
			isComplete: false
		}

		const key = `${this.AUDIO_SESSION_PREFIX}${clientId}`

		await this.redisClient.setex(key, this.SESSION_TTL, JSON.stringify(audioSession))

		this.logger.debug(`Audio session created: ${clientId}`)

		return audioSession
	}

	async addAudioChunk(clientId: string, base64Chunk: string, chunkIndex: number): Promise<AudioSession> {
		const sessionKey = `${this.AUDIO_SESSION_PREFIX}${clientId}`
		const chunksKey = `${this.AUDIO_SESSION_PREFIX}${clientId}:chunks`

		const data = await this.redisClient.get(sessionKey)

		if (!data) {
			throw new Error('Audio session not found')
		}

		const audioSession: AudioSession = JSON.parse(data)

		const audioBuffer = Buffer.from(base64Chunk, 'base64')

		await this.redisClient.lpush(chunksKey, audioBuffer)
		await this.redisClient.expire(chunksKey, this.SESSION_TTL)

		audioSession.totalChunksReceived += 1
		audioSession.totalBytes += audioBuffer.length
		audioSession.lastChunkReceivedAt = Date.now()

		await this.redisClient.setex(sessionKey, this.SESSION_TTL, JSON.stringify(audioSession))

		this.logger.debug(`Chunk ${chunkIndex} added: ${audioBuffer.length} bytes (total: ${audioSession.totalBytes})`)

		return audioSession
	}

	async concatenateAudio(clientId: string): Promise<Buffer> {
		const sessionKey = `${this.AUDIO_SESSION_PREFIX}${clientId}`
		const chunksKey = `${this.AUDIO_SESSION_PREFIX}${clientId}:chunks`

		const data = await this.redisClient.get(sessionKey)

		if (!data) {
			throw new Error('Audio session not found')
		}

		const audioSession: AudioSession = JSON.parse(data)

		const chunks = await this.redisClient.lrange(chunksKey, 0, -1)

		if (!chunks || chunks.length === 0) {
			throw new Error('No audio chunks to concatenate')
		}

		const buffers = chunks.map((chunk: any) => {
			if (Buffer.isBuffer(chunk)) {
				return chunk
			}
			if (typeof chunk === 'string') {
				return Buffer.from(chunk, 'utf-8')
			}
			return Buffer.alloc(0)
		})

		buffers.reverse()

		const fullAudioBuffer = Buffer.concat(buffers)

		this.logger.log(
			`Audio concatenated: ${fullAudioBuffer.length} bytes from ${audioSession.totalChunksReceived} chunks`
		)

		audioSession.isComplete = true

		await this.redisClient.setex(sessionKey, this.SESSION_TTL, JSON.stringify(audioSession))
		await this.redisClient.del(chunksKey)

		return fullAudioBuffer
	}

	async getAudioSession(clientId: string): Promise<AudioSession | null> {
		const key = `${this.AUDIO_SESSION_PREFIX}${clientId}`

		const data = await this.redisClient.get(key)

		if (!data) {
			return null
		}

		return JSON.parse(data)
	}

	async clearAudioSession(clientId: string): Promise<void> {
		const key = `${this.AUDIO_SESSION_PREFIX}${clientId}`

		await this.redisClient.del(key)

		this.logger.debug(`Audio session cleared: ${clientId}`)
	}

	async extendAudioSessionTTL(clientId: string): Promise<void> {
		const key = `${this.AUDIO_SESSION_PREFIX}${clientId}`

		await this.redisClient.expire(key, this.SESSION_TTL)
	}

	async saveAudioToFile(clientId: string): Promise<string> {
		const recordingsDir = path.join(process.cwd(), 'recordings')

		if (!fs.existsSync(recordingsDir)) {
			fs.mkdirSync(recordingsDir, { recursive: true })
		}

		const audioBuffer = await this.concatenateAudio(clientId)

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		const filename = `${clientId}_${timestamp}.wav`
		const filepath = path.join(recordingsDir, filename)

		fs.writeFileSync(filepath, audioBuffer)

		this.logger.log(`Audio saved to file: ${filepath}`)

		return filepath
	}
}
