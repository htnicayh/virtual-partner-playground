import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as crypto from 'crypto'
import { Repository } from 'typeorm'
import { AudioChunk, Conversation, Message, Session, User } from '../models'

export interface CreateUserDto {
	anonymousId?: string
	sessionToken?: string
}

export interface CreateConversationDto {
	userId: string
	conversationId: string
	sessionId: string
	socketId: string
}

export interface CreateMessageDto {
	conversationId: string
	role: 'user' | 'assistant'
	content: string
	contentType?: 'text' | 'audio' | 'both'
	isFinal?: boolean
	hasAudio?: boolean
	audioDurationMs?: number
}

export interface SaveAudioChunkDto {
	messageId: string
	conversationId: string
	chunkData: string
	chunkIndex: number
	mimeType?: string
	byteSize: number
}

@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name)

	constructor(
		@InjectRepository(User)
		private userRepository: Repository<User>,

		@InjectRepository(Conversation)
		private conversationRepository: Repository<Conversation>,

		@InjectRepository(Message)
		private messageRepository: Repository<Message>,

		@InjectRepository(AudioChunk)
		private audioChunkRepository: Repository<AudioChunk>,

		@InjectRepository(Session)
		private sessionRepository: Repository<Session>
	) {}

	generateAnonymousId(fingerprint: any): string {
		const data = JSON.stringify(fingerprint)

		return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32)
	}

	generateSessionToken(): string {
		return crypto.randomBytes(32).toString('hex')
	}

	async findOrCreateUser(dto: CreateUserDto): Promise<User> {
		let user: User | null = null

		if (dto.sessionToken) {
			user = await this.userRepository.findOne({
				where: { sessionToken: dto.sessionToken }
			})
		}

		if (!user && dto.anonymousId) {
			user = await this.userRepository.findOne({
				where: { anonymousId: dto.anonymousId }
			})
		}

		if (!user) {
			const sessionToken = dto.sessionToken || this.generateSessionToken()

			user = this.userRepository.create({
				anonymousId: dto.anonymousId,
				sessionToken,
				isAnonymous: true,
				firstSeenAt: new Date(),
				lastSeenAt: new Date()
			})

			user = await this.userRepository.save(user)

			this.logger.log(`Created new anonymous user: ${user.id}`)
		} else {
			user.lastSeenAt = new Date()

			await this.userRepository.save(user)
		}

		return user
	}

	async getUserBySessionToken(sessionToken: string): Promise<User | null> {
		return await this.userRepository.findOne({
			where: { sessionToken }
		})
	}

	async createConversation(dto: CreateConversationDto): Promise<Conversation> {
		const conversation = this.conversationRepository.create({
			userId: dto.userId,
			conversationId: dto.conversationId,
			sessionId: dto.sessionId,
			socketId: dto.socketId,
			status: 'active',
			startedAt: new Date()
		})

		const saved = await this.conversationRepository.save(conversation)

		await this.userRepository.increment({ id: dto.userId }, 'totalConversations', 1)

		this.logger.log(`Created conversation: ${saved.conversationId}`)
		return saved
	}

	async endConversation(conversationId: string): Promise<void> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId }
		})

		if (conversation) {
			conversation.status = 'ended'
			conversation.endedAt = new Date()

			await this.conversationRepository.save(conversation)

			this.logger.log(`Ended conversation: ${conversationId}`)
		}
	}

	async updateAudioMetrics(conversationId: string, audioBytes: number, chunks: number): Promise<void> {
		await this.conversationRepository.update(
			{ conversationId },
			{
				totalAudioBytes: () => `total_audio_bytes + ${audioBytes}`,
				totalAudioChunks: () => `total_audio_chunks + ${chunks}`
			}
		)
	}

	async getConversation(conversationId: string): Promise<Conversation | null> {
		return await this.conversationRepository.findOne({
			where: { conversationId },
			relations: ['user']
		})
	}

	async getUserConversations(userId: string, limit: number = 20, offset: number = 0): Promise<Conversation[]> {
		return await this.conversationRepository.find({
			where: { userId },
			order: { startedAt: 'DESC' },
			take: limit,
			skip: offset
		})
	}

	async saveMessage(dto: CreateMessageDto): Promise<Message> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId: dto.conversationId }
		})

		if (!conversation) {
			throw new Error(`Conversation not found: ${dto.conversationId}`)
		}

		const lastMessage = await this.messageRepository.findOne({
			where: { conversationId: conversation.id },
			order: { messageIndex: 'DESC' }
		})

		const messageIndex = lastMessage ? lastMessage.messageIndex + 1 : 0

		const message = this.messageRepository.create({
			conversationId: conversation.id,
			role: dto.role,
			content: dto.content,
			contentType: dto.contentType || 'text',
			isFinal: dto.isFinal ?? false,
			hasAudio: dto.hasAudio ?? false,
			audioDurationMs: dto.audioDurationMs,
			messageIndex
		})

		const saved = await this.messageRepository.save(message)

		this.logger.debug(`Saved message #${messageIndex} for ${dto.conversationId}`)

		return saved
	}

	async getConversationMessages(conversationId: string, limit?: number): Promise<Message[]> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId }
		})

		if (!conversation) {
			return []
		}

		const query = this.messageRepository
			.createQueryBuilder('message')
			.where('message.conversationId = :id', { id: conversation.id })
			.orderBy('message.messageIndex', 'ASC')

		if (limit) {
			query.take(limit)
		}

		return await query.getMany()
	}

	async searchMessages(userId: string, searchTerm: string, limit: number = 50): Promise<Message[]> {
		return await this.messageRepository
			.createQueryBuilder('message')
			.innerJoin('message.conversation', 'conversation')
			.where('conversation.userId = :userId', { userId })
			.andWhere(`message.search_vector @@ plainto_tsquery('english', :searchTerm)`, { searchTerm })
			.orderBy('message.created_at', 'DESC')
			.take(limit)
			.getMany()
	}

	async saveAudioChunk(dto: SaveAudioChunkDto): Promise<void> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId: dto.conversationId }
		})

		if (!conversation) {
			throw new Error(`Conversation not found: ${dto.conversationId}`)
		}

		const chunk = this.audioChunkRepository.create({
			messageId: dto.messageId,
			conversationId: conversation.id,
			chunkData: dto.chunkData,
			chunkIndex: dto.chunkIndex,
			mimeType: dto.mimeType || 'audio/pcm;rate=24000',
			byteSize: dto.byteSize
		})

		await this.audioChunkRepository.save(chunk)
	}

	async getMessageAudioChunks(messageId: string): Promise<AudioChunk[]> {
		return await this.audioChunkRepository.find({
			where: { messageId },
			order: { chunkIndex: 'ASC' }
		})
	}

	async createSession(
		userId: string,
		socketId: string,
		sessionToken: string,
		metadata?: { ipAddress?: string; userAgent?: string }
	): Promise<Session> {
		const session = this.sessionRepository.create({
			userId,
			socketId,
			sessionToken,
			ipAddress: metadata?.ipAddress,
			userAgent: metadata?.userAgent,
			isActive: true,
			connectedAt: new Date(),
			lastActivityAt: new Date()
		})

		return await this.sessionRepository.save(session)
	}

	async endSession(socketId: string): Promise<void> {
		await this.sessionRepository.update(
			{ socketId },
			{
				isActive: false,
				disconnectedAt: new Date()
			}
		)
	}

	async updateSessionActivity(socketId: string): Promise<void> {
		await this.sessionRepository.update({ socketId }, { lastActivityAt: new Date() })
	}

	async getActiveSessions(userId: string): Promise<Session[]> {
		return await this.sessionRepository.find({
			where: { userId, isActive: true },
			order: { lastActivityAt: 'DESC' }
		})
	}

	async cleanupOldAudioChunks(daysOld: number = 30): Promise<number> {
		const cutoffDate = new Date()

		cutoffDate.setDate(cutoffDate.getDate() - daysOld)

		const result = await this.audioChunkRepository
			.createQueryBuilder()
			.delete()
			.where('created_at < :cutoffDate', { cutoffDate })
			.execute()

		this.logger.log(`Cleaned up ${result.affected} old audio chunks`)

		return result.affected || 0
	}

	async cleanupInactiveSessions(daysOld: number = 7): Promise<number> {
		const cutoffDate = new Date()

		cutoffDate.setDate(cutoffDate.getDate() - daysOld)

		const result = await this.sessionRepository
			.createQueryBuilder()
			.delete()
			.where('is_active = false')
			.andWhere('disconnected_at < :cutoffDate', { cutoffDate })
			.execute()

		this.logger.log(`Cleaned up ${result.affected} inactive sessions`)

		return result.affected || 0
	}
}
