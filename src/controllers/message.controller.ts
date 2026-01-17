import {
	Body,
	Controller,
	DefaultValuePipe,
	Get,
	HttpException,
	HttpStatus,
	Logger,
	Param,
	ParseIntPipe,
	Post,
	Query,
	Req,
	UseGuards
} from '@nestjs/common'
import { SessionGuard } from '../commons/guards/session.guard'
import { CreateMessagesBatchDto } from '../dtos/message/create-message-batch.dto'
import { CreateMessageDto } from '../dtos/message/create-message.dto'
import { MessagesListResponseDto } from '../dtos/message/message-list-response.dto'
import { MessageResponseDto } from '../dtos/message/message-response.dto'
import { SearchMessagesResponseDto } from '../dtos/message/search-message-response.dto'
import { ConversationService } from '../services/conversation.service'
import { MessageService } from '../services/message.service'

@Controller()
@UseGuards(SessionGuard)
export class MessageController {
	private readonly logger = new Logger(MessageController.name)

	constructor(
		private readonly messageService: MessageService,
		private readonly conversationService: ConversationService
	) {}

	@Post('/')
	async saveMessage(@Req() req: any, @Body() dto: CreateMessageDto): Promise<MessageResponseDto> {
		try {
			const user = req.user
			const conversation = await this.conversationService.getConversationById(dto.conversationId)

			if (conversation.userId !== user.id) {
				throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND)
			}

			const message = await this.messageService.saveMessage(dto)

			return this.messageService.mapToResponseDto(message)
		} catch (error) {
			this.logger.error('Save message error', error.stack ?? error)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Post('/batch')
	async saveMessagesBatch(
		@Req() req: any,
		@Body() dto: CreateMessagesBatchDto
	): Promise<{ saved: number; messages: MessageResponseDto[] }> {
		try {
			const user = req.user

			if (dto.messages.length > 0) {
				const conversationIds = [...new Set(dto.messages.map((m) => m.conversationId))]

				const conversations = await Promise.all(
					conversationIds.map((id) => this.conversationService.getConversationById(id))
				)

				const unauthorized = conversations.some((conversation) => conversation.userId !== user.id)

				if (unauthorized) {
					throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND)
				}
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

			throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/conversation/:conversationId')
	async getConversationMessages(
		@Req() req: any,
		@Param('conversationId') conversationId: string,
		@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
	): Promise<MessagesListResponseDto> {
		try {
			const user = req.user
			const conversation = await this.conversationService.getConversationById(conversationId)

			if (conversation.userId !== user.id) {
				throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND)
			}

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

			throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/search')
	async searchMessages(
		@Req() req: any,
		@Query('q') query: string,
		@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number
	): Promise<SearchMessagesResponseDto> {
		if (!query) {
			throw new HttpException('Search query required', HttpStatus.BAD_REQUEST)
		}

		try {
			const user = req.user
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

			throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}
}
