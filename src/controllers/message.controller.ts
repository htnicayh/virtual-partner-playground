import { Body, Controller, Get, Headers, HttpException, HttpStatus, Logger, Param, Post, Query } from '@nestjs/common'
import { CreateMessagesBatchDto } from '../dtos/message/create-message-batch.dto'
import { CreateMessageDto } from '../dtos/message/create-message.dto'
import { MessagesListResponseDto } from '../dtos/message/message-list-response.dto'
import { MessageResponseDto } from '../dtos/message/message-response.dto'
import { SearchMessagesResponseDto } from '../dtos/message/search-message-response.dto'
import { MessageService } from '../services/message.service'
import { UserService } from '../services/user.service'

@Controller()
export class MessageController {
	private readonly logger = new Logger(MessageController.name)

	constructor(
		private readonly messageService: MessageService,
		private readonly userService: UserService
	) {}

	@Post('/')
	async saveMessage(@Body() dto: CreateMessageDto): Promise<MessageResponseDto> {
		try {
			const message = await this.messageService.saveMessage(dto)

			return this.messageService.mapToResponseDto(message)
		} catch (error) {
			this.logger.error(`Save message error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Post('/batch')
	async saveMessagesBatch(
		@Body() dto: CreateMessagesBatchDto
	): Promise<{ saved: number; messages: MessageResponseDto[] }> {
		try {
			const messages = await this.messageService.saveMessagesBatch(dto.messages)

			return {
				saved: messages.length,
				messages: messages.map((m) => this.messageService.mapToResponseDto(m))
			}
		} catch (error) {
			this.logger.error(`Save messages batch error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/conversation/:conversationId')
	async getConversationMessages(
		@Param('conversationId') conversationId: string,
		@Query('limit') limit?: string
	): Promise<MessagesListResponseDto> {
		try {
			const limitNum = limit ? parseInt(limit, 10) : undefined
			const messages = await this.messageService.getConversationMessages(conversationId, limitNum)

			return {
				conversationId,
				messages: messages.map((m) => this.messageService.mapToResponseDto(m)),
				total: messages.length
			}
		} catch (error) {
			this.logger.error(`Get messages error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/search')
	async searchMessages(
		@Headers('x-session-token') sessionToken: string,
		@Query('q') query: string,
		@Query('limit') limit?: string
	): Promise<SearchMessagesResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		if (!query) {
			throw new HttpException('Search query required', HttpStatus.BAD_REQUEST)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const limitNum = limit ? parseInt(limit, 10) : 50
			const messages = await this.messageService.searchMessages(user.id, query, limitNum)

			return {
				query,
				messages: messages.map((m) => this.messageService.mapToResponseDto(m)),
				total: messages.length
			}
		} catch (error) {
			this.logger.error(`Search messages error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}
}
