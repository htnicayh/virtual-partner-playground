import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ConversationService } from '../services/conversation.service'

@Controller()
export class ConversationController {
	constructor(private conversationService: ConversationService) {}

	@Post()
	async createConversation(@Body() dto: unknown) {}

	@Get(':id')
	async getConversation(@Param('id') id: string) {}

	@Get('user/:userId')
	async getUserConversations(@Param('userId') userId: string) {}

	@Delete(':id')
	async deleteConversation(@Param('id') id: string) {}
}
