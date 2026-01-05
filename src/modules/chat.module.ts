import { Module } from '@nestjs/common'
import { ChatController } from '../controllers/chat.controller'
import { LlmService } from '../services/llm.service'
import { S3Service } from '../services/s3.service'
import { TTSService } from '../services/text-to-speech.service'
import { ConversationModule } from './conversation.module'

@Module({
	imports: [ConversationModule],
	controllers: [ChatController],
	providers: [LlmService, TTSService, S3Service]
})
export class ChatModule {}
