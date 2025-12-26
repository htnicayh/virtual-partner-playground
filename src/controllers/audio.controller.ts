import { Body, Controller, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { ConversationService } from '../services/conversation.service'
import { LlmService } from '../services/llm.service'
import { SessionService } from '../services/session.service'
import { STTService } from '../services/speech-to-text.service'
import { TTSService } from '../services/text-to-speech.service'

@Controller()
export class AudioController {
	constructor(
		private sttService: STTService,
		private ttsService: TTSService,
		private llmService: LlmService,
		private conversationService: ConversationService,
		private sessionService: SessionService
	) {}

	@Post('transcribe')
	@UseInterceptors(FileInterceptor('audio'))
	async transcribeAudio(@UploadedFile() file: Express.Multer.File) {}

	@Post('process')
	@UseInterceptors(FileInterceptor('audio'))
	async processAudio(@UploadedFile() file: Express.Multer.File, @Body() dto: unknown) {}

	@Post('text-to-speech')
	async textToSpeech(@Body() body: { text: string }, @Res() res: Response) {}
}
