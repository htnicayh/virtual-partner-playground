import { Module } from '@nestjs/common'
import { ChatController } from '../controllers/chat.controller'
import { LlmService } from '../services/llm.service'
import { TTSService } from '../services/text-to-speech.service'
import { ConversationModule } from './conversation.module'

@Module({
	imports: [ConversationModule],
	controllers: [ChatController],
	providers: [LlmService, TTSService]
})
export class ChatModule {}
