import {
	Body,
	Controller,
	DefaultValuePipe,
	Get,
	Headers,
	HttpException,
	HttpStatus,
	Logger,
	Param,
	ParseIntPipe,
	Post,
	Query
} from '@nestjs/common'
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
	async saveMessage(
		@Headers('x-session-token') sessionToken: string,
		@Body() dto: CreateMessageDto
	): Promise<MessageResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

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
		@Headers('x-session-token') sessionToken: string,
		@Body() dto: CreateMessagesBatchDto
	): Promise<{ saved: number; messages: MessageResponseDto[] }> {
		try {
			if (!sessionToken) {
				throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
			}

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
		@Headers('x-session-token') sessionToken: string,
		@Param('conversationId') conversationId: string,
		@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
	): Promise<MessagesListResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const messages = await this.messageService.getConversationMessages(conversationId, limit)

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
		@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number
	): Promise<SearchMessagesResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		if (!query) {
			throw new HttpException('Search query required', HttpStatus.BAD_REQUEST)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const messages = await this.messageService.searchMessages(user.id, query, limit)

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
