import {
	Body,
	Controller,
	Get,
	Headers,
	HttpException,
	HttpStatus,
	Logger,
	Param,
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
	async getConversation(@Param('conversationId') conversationId: string): Promise<ConversationResponseDto> {
		try {
			const conversation = await this.conversationService.getConversationByConversationId(conversationId)

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
		@Param('conversationId') conversationId: string,
		@Body() dto: UpdateConversationDto
	): Promise<{ success: boolean; message: string }> {
		try {
			await this.conversationService.updateConversation(conversationId, dto)

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
		@Query('limit') limit?: string,
		@Query('offset') offset?: string
	): Promise<ConversationListResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)

			const limitNum = limit ? parseInt(limit, 10) : 20
			const offsetNum = offset ? parseInt(offset, 10) : 0

			const [conversations, total] = await Promise.all([
				this.conversationService.getUserConversations(user.id, limitNum, offsetNum),
				this.conversationService.getUserConversationsCount(user.id)
			])

			return {
				conversations: conversations.map((c) => this.conversationService.mapToResponseDto(c)),
				total,
				limit: limitNum,
				offset: offsetNum
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
