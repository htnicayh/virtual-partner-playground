import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import OpenAI from 'openai'
import * as path from 'path'

@Injectable()
export class TTSService {
	private openai: OpenAI

	constructor() {
		this.openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY
		})
	}

	async generateSpeech(text: string, outputPath?: string): Promise<Buffer> {
		try {
			const response = await this.openai.audio.speech.create({
				model: 'tts-1',
				voice: 'alloy',
				input: text
			})

			const buffer = Buffer.from(await response.arrayBuffer())

			if (outputPath) {
				fs.mkdirSync(path.dirname(outputPath), { recursive: true })
				fs.writeFileSync(outputPath, buffer)
			}

			return buffer
		} catch (error) {
			throw new Error(`TTS failed: ${(error as Error).message}`)
		}
	}

	async generateSpeechAndSave(text: string, uploadDir: string, fileName?: string): Promise<string> {
		const name = fileName || `audio-${Date.now()}.mp3`
		const outputPath = path.join(uploadDir, name)

		await this.generateSpeech(text, outputPath)

		return `/uploads/${name}`
	}
}
