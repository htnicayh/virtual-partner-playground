import { Module } from '@nestjs/common'
import { ChatController } from '../controllers/chat.controller'
import { LlmService } from '../services/llm.service'
import { ConversationModule } from './conversation.module'

@Module({
	imports: [ConversationModule],
	controllers: [ChatController],
	providers: [LlmService]
})
export class ChatModule {}
