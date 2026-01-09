import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConversationResponseDto } from '../dtos/conversation/conversation-response.dto'
import { CreateConversationDto } from '../dtos/conversation/create-conversation.dto'
import { UpdateConversationDto } from '../dtos/conversation/update-conversation.dto'
import { Conversation, User } from '../models'

@Injectable()
export class ConversationService {
	private readonly logger = new Logger(ConversationService.name)

	constructor(
		@InjectRepository(Conversation)
		private readonly conversationRepository: Repository<Conversation>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>
	) {}

	async createConversation(userId: string, dto: CreateConversationDto): Promise<Conversation> {
		const user = await this.userRepository.findOne({ where: { id: userId } })

		if (!user) {
			throw new NotFoundException('User not found')
		}

		const existing = await this.conversationRepository.findOne({
			where: { conversationId: dto.conversationId }
		})

		if (existing) {
			throw new BadRequestException('Conversation ID already exists')
		}

		const conversation = this.conversationRepository.create({
			userId,
			conversationId: dto.conversationId,
			sessionId: dto.sessionId || '',
			socketId: dto.socketId || '',
			status: 'active',
			startedAt: new Date()
		})

		const saved = await this.conversationRepository.save(conversation)

		await this.userRepository.increment({ id: userId }, 'totalConversations', 1)

		this.logger.log(`Created conversation: ${saved.conversationId} for user: ${userId}`)

		return saved
	}

	async getConversationByConversationId(conversationId: string): Promise<Conversation> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId },
			relations: ['user']
		})

		if (!conversation) {
			throw new NotFoundException('Conversation not found')
		}

		return conversation
	}

	async getConversationById(id: string): Promise<Conversation> {
		const conversation = await this.conversationRepository.findOne({
			where: { id },
			relations: ['user']
		})

		if (!conversation) {
			throw new NotFoundException('Conversation not found')
		}

		return conversation
	}

	async updateConversation(conversationId: string, dto: UpdateConversationDto): Promise<void> {
		const conversation = await this.getConversationByConversationId(conversationId)

		if (dto.status) {
			conversation.status = dto.status
			if (dto.status === 'ended') {
				conversation.endedAt = new Date()
			}
		}

		if (dto.audioBytes !== undefined && dto.audioChunks !== undefined) {
			conversation.totalAudioBytes += dto.audioBytes
			conversation.totalAudioChunks += dto.audioChunks
		}

		await this.conversationRepository.save(conversation)

		this.logger.log(`Updated conversation: ${conversationId}`)
	}

	async endConversation(conversationId: string): Promise<void> {
		const conversation = await this.getConversationByConversationId(conversationId)

		conversation.status = 'ended'
		conversation.endedAt = new Date()

		await this.conversationRepository.save(conversation)

		this.logger.log(`Ended conversation: ${conversationId}`)
	}

	async getUserConversations(userId: string, limit = 20, offset = 0): Promise<Conversation[]> {
		return this.conversationRepository.find({
			where: { userId },
			order: { startedAt: 'DESC' },
			take: limit,
			skip: offset
		})
	}

	async getUserConversationsCount(userId: string): Promise<number> {
		return this.conversationRepository.count({ where: { userId } })
	}

	mapToResponseDto(conversation: Conversation): ConversationResponseDto {
		return {
			id: conversation.id,
			conversationId: conversation.conversationId,
			status: conversation.status,
			startedAt: conversation.startedAt,
			endedAt: conversation.endedAt,
			durationSeconds: conversation.durationSeconds,
			totalMessages: conversation.totalMessages,
			userMessages: conversation.userMessages,
			aiMessages: conversation.aiMessages
		}
	}
}
