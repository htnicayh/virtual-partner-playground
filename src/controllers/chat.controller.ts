import { Body, Controller, Post } from '@nestjs/common'
import { ConversationService } from '../services/conversation.service'
import { LlmService } from '../services/llm.service'
import { TTSService } from '../services/text-to-speech.service'

@Controller()
export class ChatController {
	constructor(
		private llmService: LlmService,
		private conversationService: ConversationService,
		private ttsService: TTSService
	) {}

	@Post('message')
	async sendMessage(@Body() dto: unknown) {}
}
