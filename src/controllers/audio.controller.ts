import { HttpService } from '@nestjs/axios'
import { Body, Controller, Logger, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { firstValueFrom } from 'rxjs'

@Controller()
export class AudioController {
	private readonly logger: Logger = new Logger(AudioController.name)

	constructor(private readonly httpService: HttpService) {}

	@Post('/proxy-audio')
	async proxyAudio(@Body() body: { url: string }, @Res() res: Response) {
		try {
			const { url } = body

			if (!url) {
				return res.status(400).json({ error: 'URL is required' })
			}

			this.logger.debug('Fetching audio from:', url)

			const response = await firstValueFrom(
				this.httpService.get(url, {
					responseType: 'arraybuffer',
					timeout: 60000,
					maxRedirects: 5,
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
						Accept: 'audio/mpeg, audio/*',
						Range: undefined
					},
					validateStatus: () => true // Accept all status codes
				})
			)

			const audioBuffer = Buffer.from(response.data)

			this.logger.debug(`Response status: ${response.status}`)
			this.logger.debug(`Audio buffer size: ${audioBuffer.length}`)
			this.logger.debug(`First 20 bytes (hex): ${audioBuffer.toString('hex', 0, 20)}`)
			this.logger.debug(`Content-Type header: ${response.headers['content-type']}`)

			if (audioBuffer.length < 100) {
				throw new Error(`Audio file too small: ${audioBuffer.length} bytes`)
			}

			const header = audioBuffer.toString('hex', 0, 3)

			if (!header.startsWith('fff') && !header.startsWith('494433')) {
				this.logger.warn(`Warning: File may not be valid MP3, header: ${header}`)
			}

			res.setHeader('Access-Control-Allow-Origin', '*')
			res.setHeader('Content-Type', 'audio/mpeg')
			res.setHeader('Content-Length', audioBuffer.length)
			res.setHeader('Cache-Control', 'public, max-age=3600')
			res.setHeader('Accept-Ranges', 'bytes')

			res.send(audioBuffer)
		} catch (error) {
			this.logger.error('Proxy audio error:', error)

			res.status(500).json({
				error: `Failed to fetch audio: ${error.message}`,
				details: error.stack
			})
		}
	}

	@Post('transcribe')
	@UseInterceptors(FileInterceptor('audio'))
	async transcribeAudio(@UploadedFile() file: Express.Multer.File) {}

	@Post('process')
	@UseInterceptors(FileInterceptor('audio'))
	async processAudio(@UploadedFile() file: Express.Multer.File, @Body() dto: unknown) {}

	@Post('text-to-speech')
	async textToSpeech(@Body() body: { text: string }, @Res() res: Response) {}
}
