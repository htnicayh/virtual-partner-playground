import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import Redis from 'ioredis'
import * as path from 'path'
import { saveAudioBufferAsWav } from '../utils'
import { AudioSession } from '../commons/interfaces/audio-session.interface'

@Injectable()
export class AudioService {
	private readonly logger = new Logger(AudioService.name)
	private readonly AUDIO_SESSION_PREFIX = 'audio:session:'
	private readonly AUDIO_CHUNKS_PREFIX = 'audio:chunks:'
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

		// Store metadata only, not actual buffers
		await this.redisClient.setex(
			key,
			this.SESSION_TTL,
			JSON.stringify({
				...audioSession,
				audioChunks: [] // Empty array, we'll store chunks separately
			})
		)

		// Clear any previous chunks
		await this.redisClient.del(`${this.AUDIO_CHUNKS_PREFIX}${clientId}:*`)

		this.logger.debug(`Audio session created: ${clientId}`)

		return audioSession
	}

	async addAudioChunk(clientId: string, base64Chunk: string, chunkIndex: number): Promise<AudioSession> {
		const sessionKey = `${this.AUDIO_SESSION_PREFIX}${clientId}`
		const chunksKey = `${this.AUDIO_CHUNKS_PREFIX}${clientId}:${chunkIndex}`

		const data = await this.redisClient.get(sessionKey)

		if (!data) {
			throw new Error('Audio session not found')
		}

		const audioSession: AudioSession = JSON.parse(data)

		// Store chunk as base64 string (no serialization issues)
		await this.redisClient.setex(chunksKey, this.SESSION_TTL, base64Chunk)

		audioSession.totalChunksReceived += 1
		audioSession.lastChunkReceivedAt = Date.now()

		// Calculate bytes from base64
		const decodedLength = Math.floor((base64Chunk.length * 3) / 4)
		audioSession.totalBytes += decodedLength

		// Update session metadata
		await this.redisClient.setex(
			sessionKey,
			this.SESSION_TTL,
			JSON.stringify({
				...audioSession,
				audioChunks: [] // Keep empty in metadata
			})
		)

		this.logger.debug(`Chunk ${chunkIndex} added: ~${decodedLength} bytes (total: ${audioSession.totalBytes})`)

		return audioSession
	}

	async concatenateAudio(clientId: string): Promise<Buffer> {
		const sessionKey = `${this.AUDIO_SESSION_PREFIX}${clientId}`

		const data = await this.redisClient.get(sessionKey)

		if (!data) {
			throw new Error('Audio session not found')
		}

		const audioSession: AudioSession = JSON.parse(data)

		// Get all chunks
		const pattern = `${this.AUDIO_CHUNKS_PREFIX}${clientId}:*`
		const keys = await this.redisClient.keys(pattern)

		if (keys.length === 0) {
			throw new Error('No audio chunks found')
		}

		// Sort by chunk index
		keys.sort((a, b) => {
			const indexA = parseInt(a.split(':').pop() || '0')
			const indexB = parseInt(b.split(':').pop() || '0')
			return indexA - indexB
		})

		this.logger.debug(`Concatenating ${keys.length} chunks from Redis`)

		const buffers: Buffer[] = []

		for (const key of keys) {
			const base64Data = await this.redisClient.get(key)

			if (!base64Data) {
				this.logger.warn(`Chunk data missing for key: ${key}`)
				continue
			}

			try {
				const buffer = Buffer.from(base64Data, 'base64')
				buffers.push(buffer)
			} catch (error) {
				this.logger.error(`Failed to decode chunk from key ${key}: ${(error as Error).message}`)
			}
		}

		if (buffers.length === 0) {
			throw new Error('Failed to decode audio chunks')
		}

		const fullAudioBuffer = Buffer.concat(buffers)

		this.logger.log(`Audio concatenated: ${fullAudioBuffer.length} bytes from ${buffers.length} chunks`)

		audioSession.isComplete = true

		await this.redisClient.setex(
			sessionKey,
			this.SESSION_TTL,
			JSON.stringify({
				...audioSession,
				audioChunks: []
			})
		)

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
		const chunksPattern = `${this.AUDIO_CHUNKS_PREFIX}${clientId}:*`

		await this.redisClient.del(key)

		// Delete all chunks
		const keys = await this.redisClient.keys(chunksPattern)
		if (keys.length > 0) {
			await this.redisClient.del(...keys)
		}

		this.logger.debug(`Audio session cleared: ${clientId}`)
	}

	async extendAudioSessionTTL(clientId: string): Promise<void> {
		const key = `${this.AUDIO_SESSION_PREFIX}${clientId}`
		const chunksPattern = `${this.AUDIO_CHUNKS_PREFIX}${clientId}:*`

		await this.redisClient.expire(key, this.SESSION_TTL)

		const keys = await this.redisClient.keys(chunksPattern)
		if (keys.length > 0) {
			keys.forEach((k) => this.redisClient.expire(k, this.SESSION_TTL))
		}
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

		await saveAudioBufferAsWav(filepath, audioBuffer, 1, 16000, 2)

		this.logger.log(`Audio saved to WAV file: ${filepath}`)

		return filepath
	}
}
