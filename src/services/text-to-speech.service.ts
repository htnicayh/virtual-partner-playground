import { GoogleGenAI, Modality } from '@google/genai'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import OpenAI from 'openai'
import * as path from 'path'
import { WordTiming } from '../commons/interfaces/word-timing.interface'
import { handleGeminiPlayback } from '../utils'

@Injectable()
export class TTSService {
	private readonly logger = new Logger(TTSService.name)
	private readonly openai: OpenAI
	private readonly googleai: GoogleGenAI

	private readonly VOICE = 'alloy'
	private readonly SPEED = 1.0
	private readonly AVG_CHARS_PER_MS = 0.08

	constructor(private readonly configService: ConfigService) {
		const openAIApiKey = this.configService.get<string>('OPENAI_API_KEY') as string
		const googleApiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY') as string

		if (!openAIApiKey) {
			throw new Error('OPENAI_API_KEY is not set')
		}

		if (!googleApiKey) {
			throw new Error('GOOGLE_GEMINI_API_KEY is not set')
		}

		this.openai = new OpenAI({ apiKey: openAIApiKey })
		this.googleai = new GoogleGenAI({ apiKey: googleApiKey })
	}

	async generateSpeechAndSave(text: string, uploadDir: string, fileName?: string): Promise<string> {
		try {
			const response = await this.openai.audio.speech.create({
				model: 'tts-1',
				voice: this.VOICE,
				input: text,
				speed: this.SPEED
			})

			const buffer = Buffer.from(await response.arrayBuffer())

			const final = fileName || `audio-${Date.now()}.mp3`
			const outputPath = path.join(uploadDir, final)

			fs.mkdirSync(uploadDir, { recursive: true })
			fs.writeFileSync(outputPath, buffer)

			this.logger.log(`MP3 saved: ${final} (${buffer.length} bytes)`)

			return `/uploads/${final}`
		} catch (error) {
			this.logger.error(`TTS API failed: ${error.message}`)

			throw new Error(`TTS failed: ${error.message}`)
		}
	}

	async generateSpeechBase64(text: string): Promise<string> {
		try {
			const response = await this.openai.audio.speech.create({
				model: 'tts-1',
				voice: this.VOICE,
				input: text,
				speed: this.SPEED
			})

			const buffer = Buffer.from(await response.arrayBuffer())
			const base64Audio = buffer.toString('base64')
			const dataUrl = `data:audio/mpeg;base64,${base64Audio}`

			this.logger.log(`Audio encoded to Base64: ${buffer.length} bytes → ${dataUrl.length} chars`)

			return dataUrl
		} catch (error) {
			this.logger.error(`TTS API failed: ${error.message}`)

			throw new Error(`TTS failed: ${error.message}`)
		}
	}

	async generateSpeechWithGemini(text: string, uploadDir: string, fileName?: string): Promise<string> {
		try {
			const response = await this.googleai.models.generateContent({
				model: 'gemini-2.5-flash-preview-tts',
				contents: [
					{
						parts: [
							{
								text
							}
						]
					}
				],
				config: {
					responseModalities: ['AUDIO'],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName: 'Kore' }
						}
					}
				}
			})

			const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data

			if (!audioData) {
				throw new Error('No audio data in Gemini response')
			}

			const buffer = Buffer.from(audioData, 'base64')

			const final = fileName || `audio-gemini-${Date.now()}.mp3`
			const outputPath = path.join(uploadDir, final)

			fs.mkdirSync(uploadDir, { recursive: true })
			handleGeminiPlayback(outputPath, buffer)

			this.logger.log(`Gemini TTS MP3 saved: ${final} (${buffer.length} bytes)`)

			return `/uploads/${final}`
		} catch (error) {
			this.logger.error(`Gemini TTS API failed: ${error.message}`)

			throw new Error(`Gemini TTS failed: ${error.message}`)
		}
	}

	async generateSpeechGeminiBase64(text: string): Promise<string> {
		try {
			const response = await this.googleai.models.generateContent({
				model: 'gemini-2.5-flash-preview-tts',
				contents: [
					{
						parts: [
							{
								text
							}
						]
					}
				],
				config: {
					responseModalities: ['AUDIO'],
					speechConfig: {
						voiceConfig: {
							prebuiltVoiceConfig: { voiceName: 'Kore' }
						}
					}
				}
			})

			const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data

			if (!audioData) {
				throw new Error('No audio data in Gemini response')
			}

			const dataUrl = `data:audio/mp3;base64,${audioData}`

			this.logger.log(`Gemini Audio encoded to Base64: ${audioData.length} chars`)

			return dataUrl
		} catch (error) {
			this.logger.error(`Gemini TTS API failed: ${error.message}`)

			throw new Error(`Gemini TTS failed: ${error.message}`)
		}
	}

	calculateWordTimings(text: string): WordTiming[] {
		const wordTimings: WordTiming[] = []
		const words = text.split(/\s+/).filter((w) => w.length > 0)

		let currentTime = 0

		for (const word of words) {
			const duration = Math.ceil(word.length * (1000 * this.AVG_CHARS_PER_MS))

			wordTimings.push({
				word,
				startTime: currentTime,
				endTime: currentTime + duration,
				duration
			})

			currentTime += duration + 50
		}

		this.logger.debug(`Word timings calculated: ${wordTimings.length} words, total ${currentTime}ms`)

		return wordTimings
	}

	async synthesizeWithTimings(
		text: string,
		uploadDir: string,
		provider: 'openai' | 'google' = 'google'
	): Promise<{
		audioUrl: string
		wordTimings: WordTiming[]
		duration: number
		provider: string
	}> {
		try {
			let audioUrl: string

			switch (provider) {
				case 'google':
					audioUrl = await this.generateSpeechWithGemini(text, uploadDir)
					break
				case 'openai':
				default:
					audioUrl = await this.generateSpeechAndSave(text, uploadDir)
					break
			}

			const wordTimings = this.calculateWordTimings(text)
			const totalDuration = wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime : 0

			this.logger.log(`TTS complete (${provider}): ${totalDuration}ms duration`)

			return {
				audioUrl,
				wordTimings,
				duration: totalDuration,
				provider
			}
		} catch (error) {
			this.logger.error(`TTS synthesis failed: ${error.message}`)

			throw error
		}
	}
}
