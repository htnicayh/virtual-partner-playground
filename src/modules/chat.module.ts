import { Module } from '@nestjs/common'
import { ChatController } from '../controllers/chat.controller'
import { LlmService } from '../services/llm.service'

@Module({
	controllers: [ChatController],
	providers: [LlmService]
})
export class ChatModule {}
