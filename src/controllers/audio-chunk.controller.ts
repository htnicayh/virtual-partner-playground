import { Body, Controller, Delete, Get, HttpException, HttpStatus, Logger, Param, Post, Query } from '@nestjs/common'

import { AudioChunksListResponseDto } from '../dtos/audio/audio-chunks-list-response.dto'
import { SaveAudioChunkDto } from '../dtos/audio/save-audio-chunk.dto'
import { AudioChunkService } from '../services/audio-chunk.service'

@Controller()
export class AudioChunkController {
	private readonly logger = new Logger(AudioChunkController.name)

	constructor(private readonly audioChunkService: AudioChunkService) {}

	@Post('/')
	async saveAudioChunk(@Body() dto: SaveAudioChunkDto): Promise<{ success: boolean; chunkId: string }> {
		try {
			const chunk = await this.audioChunkService.saveAudioChunk(dto)

			return {
				success: true,
				chunkId: chunk.id
			}
		} catch (error) {
			this.logger.error(`Save audio chunk error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException('An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/message/:messageId')
	async getMessageAudioChunks(@Param('messageId') messageId: string): Promise<AudioChunksListResponseDto> {
		try {
			const chunks = await this.audioChunkService.getMessageAudioChunks(messageId)
			const totalBytes = chunks.reduce((sum, chunk) => sum + (chunk.byteSize || 0), 0)

			return {
				messageId,
				chunks: chunks.map((c) => this.audioChunkService.mapToResponseDto(c)),
				total: chunks.length,
				totalBytes
			}
		} catch (error) {
			this.logger.error(`Get message audio chunks error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException('An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/conversation/:conversationId')
	async getConversationAudioChunks(
		@Param('conversationId') conversationId: string
	): Promise<AudioChunksListResponseDto> {
		try {
			const chunks = await this.audioChunkService.getConversationAudioChunks(conversationId)
			const totalBytes = chunks.reduce((sum, chunk) => sum + (chunk.byteSize || 0), 0)

			return {
				messageId: 'N/A',
				chunks: chunks.map((c) => this.audioChunkService.mapToResponseDto(c)),
				total: chunks.length,
				totalBytes
			}
		} catch (error) {
			this.logger.error(`Get conversation audio chunks error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException('An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Delete('/message/:messageId')
	async deleteMessageAudioChunks(
		@Param('messageId') messageId: string
	): Promise<{ success: boolean; deleted: number }> {
		try {
			const deleted = await this.audioChunkService.deleteMessageAudioChunks(messageId)

			return { success: true, deleted }
		} catch (error) {
			this.logger.error(`Delete message audio chunks error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException('An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Delete('/conversation/:conversationId')
	async deleteConversationAudioChunks(
		@Param('conversationId') conversationId: string
	): Promise<{ success: boolean; deleted: number }> {
		try {
			const deleted = await this.audioChunkService.deleteConversationAudioChunks(conversationId)

			return { success: true, deleted }
		} catch (error) {
			this.logger.error(`Delete conversation audio chunks error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException('An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Delete('/cleanup')
	async cleanupOldAudioChunks(@Query('days') days?: string): Promise<{ success: boolean; deleted: number }> {
		try {
			const daysOld = days ? parseInt(days, 10) : 30

			if (!Number.isFinite(daysOld) || daysOld <= 0) {
				throw new HttpException('days must be a positive integer', HttpStatus.BAD_REQUEST)
			}

			const deleted = await this.audioChunkService.cleanupOldAudioChunks(daysOld)

			return { success: true, deleted }
		} catch (error) {
			this.logger.error(`Cleanup audio chunks error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException('An unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}
}
