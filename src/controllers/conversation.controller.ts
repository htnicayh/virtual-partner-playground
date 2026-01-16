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
	Put,
	Query
} from '@nestjs/common'
import { ConversationListResponseDto } from '../dtos/conversation/conversation-list-response.dto'
import { ConversationResponseDto } from '../dtos/conversation/conversation-response.dto'
import { CreateConversationDto } from '../dtos/conversation/create-conversation.dto'
import { UpdateConversationDto } from '../dtos/conversation/update-conversation.dto'
import { ConversationService } from '../services/conversation.service'
import { UserService } from '../services/user.service'

@Controller()
export class ConversationController {
	private readonly logger = new Logger(ConversationController.name)

	constructor(
		private readonly userService: UserService,
		private readonly conversationService: ConversationService
	) {}

	@Post('/')
	async createConversation(
		@Headers('x-session-token') sessionToken: string,
		@Body() dto: CreateConversationDto
	): Promise<ConversationResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const conversation = await this.conversationService.createConversation(user.id, dto)

			return this.conversationService.mapToResponseDto(conversation)
		} catch (error) {
			this.logger.error(`Create conversation error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/:conversationId')
	async getConversation(
		@Headers('x-session-token') sessionToken: string,
		@Param('conversationId') conversationId: string
	): Promise<ConversationResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const conversation = await this.conversationService.getConversationByConversationId(conversationId)

			if (conversation.userId !== user.id) {
				throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND)
			}

			return this.conversationService.mapToResponseDto(conversation)
		} catch (error) {
			this.logger.error(`Get conversation error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Put('/:conversationId')
	async updateConversation(
		@Headers('x-session-token') sessionToken: string,
		@Param('conversationId') conversationId: string,
		@Body() dto: UpdateConversationDto
	): Promise<{ success: boolean; message: string }> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const conversation = await this.conversationService.getConversationByConversationId(conversationId)

			if (conversation.userId !== user.id) {
				throw new HttpException('Conversation not found', HttpStatus.NOT_FOUND)
			}

			await this.conversationService.updateConversation(conversation.id, dto)

			return { success: true, message: 'Conversation updated successfully' }
		} catch (error) {
			this.logger.error(`Update conversation error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/')
	async getUserConversations(
		@Headers('x-session-token') sessionToken: string,
		@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
	): Promise<ConversationListResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)

			const [conversations, total] = await Promise.all([
				this.conversationService.getUserConversations(user.id, limit, offset),
				this.conversationService.getUserConversationsCount(user.id)
			])

			return {
				conversations: conversations.map((c) => this.conversationService.mapToResponseDto(c)),
				total,
				limit,
				offset
			}
		} catch (error) {
			this.logger.error(`Get conversations error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}
}
