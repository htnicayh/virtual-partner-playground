import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import OpenAI from 'openai'

@Injectable()
export class STTService {
	private readonly openai: OpenAI

	constructor() {
		this.openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY
		})
	}

	async transcribeAudio(filePath: string): Promise<string> {
		try {
			const audioFile = fs.createReadStream(filePath)

			const transcript = await this.openai.audio.transcriptions.create({
				file: audioFile,
				model: 'whisper-1',
				language: 'en'
			})

			return transcript.text
		} catch (error) {
			throw new Error(`STT failed: ${(error as Error).message}`)
		}
	}

	async transcribeAudioFromBuffer(buffer: Buffer): Promise<string> {
		try {
			const transcript = await this.openai.audio.transcriptions.create({
				file: new File([buffer], 'audio.wav', { type: 'audio/wav' }),
				model: 'whisper-1',
				language: 'en'
			})

			return transcript.text
		} catch (error) {
			throw new Error(`STT failed: ${(error as Error).message}`)
		}
	}
}
