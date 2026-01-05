import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { AudioController } from '../controllers/audio.controller'
import { LlmService } from '../services/llm.service'
import { S3Service } from '../services/s3.service'
import { SessionService } from '../services/session.service'
import { STTService } from '../services/speech-to-text.service'
import { TTSService } from '../services/text-to-speech.service'
import { ConversationModule } from './conversation.module'

@Module({
	imports: [ConversationModule, HttpModule],
	controllers: [AudioController],
	providers: [LlmService, STTService, TTSService, S3Service, SessionService]
})
export class AudioModule {}
