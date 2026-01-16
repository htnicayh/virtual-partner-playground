import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'
import { AudioChunkResponseDto } from '../dtos/audio/audio-chunk-response.dto'
import { SaveAudioChunkDto } from '../dtos/audio/save-audio-chunk.dto'
import { AudioChunk, Conversation, Message } from '../models'

@Injectable()
export class AudioChunkService {
	private readonly logger = new Logger(AudioChunkService.name)

	constructor(
		@InjectRepository(AudioChunk)
		private readonly audioChunkRepository: Repository<AudioChunk>,
		@InjectRepository(Message)
		private readonly messageRepository: Repository<Message>,
		@InjectRepository(Conversation)
		private readonly conversationRepository: Repository<Conversation>
	) {}

	async saveAudioChunk(dto: SaveAudioChunkDto): Promise<AudioChunk> {
		const message = await this.messageRepository.findOne({
			where: { id: dto.messageId }
		})

		if (!message) {
			throw new NotFoundException('Message not found')
		}

		const conversation = await this.conversationRepository.findOne({
			where: { conversationId: dto.conversationId }
		})

		if (!conversation) {
			throw new NotFoundException('Conversation not found')
		}

		if (message.conversationId !== conversation.id) {
			throw new BadRequestException('Message does not belong to conversation')
		}

		const chunk = this.audioChunkRepository.create({
			messageId: dto.messageId,
			conversationId: conversation.id,
			chunkData: dto.chunkData,
			chunkIndex: dto.chunkIndex,
			mimeType: dto.mimeType || 'audio/pcm;rate=24000',
			byteSize: dto.byteSize
		})

		const saved = await this.audioChunkRepository.save(chunk)

		this.logger.debug(`Saved audio chunk #${dto.chunkIndex} for message: ${dto.messageId}`)

		return saved
	}

	async getMessageAudioChunks(messageId: string): Promise<AudioChunk[]> {
		const message = await this.messageRepository.findOne({
			where: { id: messageId }
		})

		if (!message) {
			throw new NotFoundException('Message not found')
		}

		return this.audioChunkRepository.find({
			where: { messageId },
			order: { chunkIndex: 'ASC' }
		})
	}

	async getConversationAudioChunks(conversationId: string): Promise<AudioChunk[]> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId }
		})

		if (!conversation) {
			throw new NotFoundException('Conversation not found')
		}

		return this.audioChunkRepository.find({
			where: { conversationId: conversation.id },
			order: { createdAt: 'ASC', chunkIndex: 'ASC' }
		})
	}

	async cleanupOldAudioChunks(daysOld = 30): Promise<number> {
		if (!Number.isFinite(daysOld) || daysOld <= 0) {
			throw new BadRequestException('days must be a positive integer')
		}

		const cutoffDate = new Date()

		cutoffDate.setDate(cutoffDate.getDate() - daysOld)

		const result = await this.audioChunkRepository.delete({
			createdAt: LessThan(cutoffDate)
		})

		const deleted = result.affected || 0

		this.logger.log(`Cleaned up ${deleted} old audio chunks`)

		return deleted
	}

	async deleteMessageAudioChunks(messageId: string): Promise<number> {
		const result = await this.audioChunkRepository.delete({ messageId })

		const deleted = result.affected || 0

		this.logger.log(`Deleted ${deleted} audio chunks for message: ${messageId}`)

		return deleted
	}

	async deleteConversationAudioChunks(conversationId: string): Promise<number> {
		const conversation = await this.conversationRepository.findOne({
			where: { conversationId }
		})

		if (!conversation) {
			throw new NotFoundException('Conversation not found')
		}

		const result = await this.audioChunkRepository.delete({
			conversationId: conversation.id
		})

		const deleted = result.affected || 0

		this.logger.log(`Deleted ${deleted} audio chunks for conversation: ${conversationId}`)

		return deleted
	}

	mapToResponseDto(chunk: AudioChunk): AudioChunkResponseDto {
		return {
			id: chunk.id,
			chunkIndex: chunk.chunkIndex,
			mimeType: chunk.mimeType,
			byteSize: chunk.byteSize,
			createdAt: chunk.createdAt
		}
	}
}
