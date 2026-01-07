import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { AudioController } from '../controllers/audio.controller'
import { LlmService } from '../services/llm.service'
import { SessionService } from '../services/session.service'
import { ConversationModule } from './conversation.module'

@Module({
	imports: [ConversationModule, HttpModule],
	controllers: [AudioController],
	providers: [LlmService, SessionService]
})
export class AudioModule {}
