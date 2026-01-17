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
	Put,
	Query,
	Req,
	UseGuards
} from '@nestjs/common'
import { SessionGuard } from '../commons/guards/session.guard'
import { ConversationListResponseDto } from '../dtos/conversation/conversation-list-response.dto'
import { ConversationResponseDto } from '../dtos/conversation/conversation-response.dto'
import { CreateConversationDto } from '../dtos/conversation/create-conversation.dto'
import { UpdateConversationDto } from '../dtos/conversation/update-conversation.dto'
import { ConversationService } from '../services/conversation.service'

@Controller()
@UseGuards(SessionGuard)
export class ConversationController {
	private readonly logger = new Logger(ConversationController.name)

	constructor(private readonly conversationService: ConversationService) {}

	@Get('/')
	async getUserConversations(
		@Req() req: any,
		@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
	): Promise<ConversationListResponseDto> {
		try {
			const user = req.user

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

	@Post('/')
	async createConversation(@Req() req: any, @Body() dto: CreateConversationDto): Promise<ConversationResponseDto> {
		try {
			const user = req.user
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

	@Get('id/:conversationId')
	async getConversation(
		@Req() req: any,
		@Param('conversationId') conversationId: string
	): Promise<ConversationResponseDto> {
		try {
			const user = req.user
			const conversation = await this.conversationService.getConversationById(conversationId)

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

	@Put('id/:conversationId')
	async updateConversation(
		@Req() req: any,
		@Param('conversationId') conversationId: string,
		@Body() dto: UpdateConversationDto
	): Promise<{ success: boolean; message: string }> {
		try {
			const user = req.user
			const conversation = await this.conversationService.getConversationById(conversationId)

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
}
