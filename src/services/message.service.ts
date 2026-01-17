import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CreateMessageDto } from '../dtos/message/create-message.dto'
import { MessageResponseDto } from '../dtos/message/message-response.dto'
import { Conversation, Message } from '../models'

@Injectable()
export class MessageService {
	private readonly logger = new Logger(MessageService.name)

	constructor(
		@InjectRepository(Message)
		private readonly messageRepository: Repository<Message>,
		@InjectRepository(Conversation)
		private readonly conversationRepository: Repository<Conversation>
	) {}

	async saveMessage(dto: CreateMessageDto): Promise<Message> {
		return this.messageRepository.manager.transaction(async (manager) => {
			const conversation = await this.conversationRepository.findOne({
				where: { conversationId: dto.conversationId }
			})

			if (!conversation) {
				throw new NotFoundException(`Conversation not found: ${dto.conversationId}`)
			}

			const lastMessage = await manager.findOne(Message, {
				where: { conversationId: conversation.id },
				order: { messageIndex: 'DESC' },
				lock: { mode: 'pessimistic_write' }
			})

			const messageIndex = lastMessage ? lastMessage.messageIndex + 1 : 0
			const message = manager.create(Message, {
				conversationId: conversation.id,
				role: dto.role,
				content: dto.content,
				contentType: dto.contentType || 'text',
				isFinal: dto.isFinal ?? true,
				hasAudio: dto.hasAudio ?? false,
				audioDurationMs: dto.audioDurationMs,
				messageIndex
			})

			const saved = await manager.save(message)

			this.logger.debug(`Saved message #${messageIndex} for conversation: ${dto.conversationId}`)

			return saved
		})
	}

	async saveMessagesBatch(messages: CreateMessageDto[]): Promise<Message[]> {
		const savedMessages: Message[] = []

		for (const messageDto of messages) {
			const message = await this.saveMessage(messageDto)

			savedMessages.push(message)
		}

		return savedMessages
	}

	async getConversationMessages(conversationId: string, limit?: number): Promise<Message[]> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId }
		})

		if (!conversation) {
			throw new NotFoundException('Conversation not found')
		}

		const query = this.messageRepository
			.createQueryBuilder('message')
			.where('message.conversationId = :id', { id: conversation.id })
			.orderBy('message.messageIndex', 'ASC')

		if (limit) {
			query.take(limit)
		}

		return query.getMany()
	}

	async searchMessages(userId: string, searchTerm: string, limit = 50): Promise<Message[]> {
		return this.messageRepository
			.createQueryBuilder('message')
			.innerJoin('message.conversation', 'conversation')
			.where('conversation.userId = :userId', { userId })
			.andWhere(`message.search_vector @@ plainto_tsquery('english', :searchTerm)`, {
				searchTerm
			})
			.orderBy('message.created_at', 'DESC')
			.take(limit)
			.getMany()
	}

	async getMessageById(id: string): Promise<Message> {
		const message = await this.messageRepository.findOne({ where: { id } })

		if (!message) {
			throw new NotFoundException('Message not found')
		}

		return message
	}

	mapToResponseDto(message: Message): MessageResponseDto {
		return {
			id: message.id,
			role: message.role,
			content: message.content,
			contentType: message.contentType,
			messageIndex: message.messageIndex,
			isFinal: message.isFinal,
			hasAudio: message.hasAudio,
			createdAt: message.createdAt
		}
	}
}
