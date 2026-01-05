import { GoogleGenAI } from '@google/genai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import OpenAI from 'openai'

@Injectable()
export class STTService implements OnModuleInit {
	private readonly logger = new Logger(STTService.name)
	private openai: OpenAI
	private google: GoogleGenerativeAI
	private googleai: GoogleGenAI

	constructor(private readonly configService: ConfigService) {}

	onModuleInit() {
		const googleApiKey =
			(this.configService.get<string>('GOOGLE_GEMINI_API_KEY') as string) ?? process.env.GOOGLE_GEMINI_API_KEY
		const openAIApiKey = (this.configService.get<string>('OPENAI_API_KEY') as string) ?? process.env.OPENAI_API_KEY

		if (!openAIApiKey) {
			throw new Error('OPENAI_API_KEY is not set')
		}

		if (!googleApiKey) {
			throw new Error('GOOGLE_GEMINI_API_KEY is not set')
		}

		this.openai = new OpenAI({ apiKey: openAIApiKey })
		this.googleai = new GoogleGenAI({ apiKey: googleApiKey })
		this.google = new GoogleGenerativeAI(googleApiKey)
	}

	async transcribeAudio(filePath: string): Promise<string> {
		try {
			this.logger.log(`[Whisper] Transcribing audio file: ${filePath}`)

			const audioFile = fs.createReadStream(filePath)

			const transcript = await this.openai.audio.transcriptions.create({
				file: audioFile,
				model: 'whisper-1',
				language: 'en'
			})

			this.logger.log(`[Whisper] Transcription complete: "${transcript.text.substring(0, 50)}..."`)

			return transcript.text
		} catch (e) {
			this.logger.error(`[Whisper] Transcription failed: ${(e as Error).message}`)

			throw new Error(`Whisper STT failed: ${(e as Error).message}`)
		}
	}

	async transcribeAudioFromBuffer(buffer: Buffer): Promise<string> {
		try {
			this.logger.log(`[Whisper] Transcribing audio buffer: ${buffer.length} bytes`)

			const transcript = await this.openai.audio.transcriptions.create({
				file: new File([buffer], 'audio.webm', { type: 'audio/webm' }),
				model: 'whisper-1',
				language: 'en'
			})

			this.logger.log(`[Whisper] Transcription complete: "${transcript.text.substring(0, 50)}..."`)

			return transcript.text
		} catch (e) {
			this.logger.error(`[Whisper] Transcription failed: ${(e as Error).message}`)

			throw new Error(`Whisper STT failed: ${(e as Error).message}`)
		}
	}

	async transcribeAudioWithConfidence(buffer: Buffer): Promise<{
		text: string
		confidence: number
	}> {
		try {
			this.logger.log(`[Whisper] Transcribing with confidence: ${buffer.length} bytes`)

			const transcript = await this.openai.audio.transcriptions.create({
				file: new File([buffer], 'audio.webm', { type: 'audio/webm' }),
				model: 'whisper-1',
				language: 'en'
			})

			const confidenceEstimate = this.estimateConfidence(transcript.text)

			this.logger.log(
				`[Whisper] Transcription: "${transcript.text.substring(0, 50)}..." (confidence: ${confidenceEstimate})`
			)

			return {
				text: transcript.text,
				confidence: confidenceEstimate
			}
		} catch (e) {
			this.logger.error(`[Whisper] Transcription failed: ${(e as Error).message}`)

			throw new Error(`Whisper STT failed: ${(e as Error).message}`)
		}
	}

	async transcribeAudioWithGemini(buffer: Buffer): Promise<string> {
		try {
			this.logger.log(`[Gemini Audio] Transcribing audio: ${buffer.length} bytes`)

			const base64Audio = buffer.toString('base64')
			const response = await this.googleai.models.generateContent({
				model: 'gemini-2.5-flash',
				contents: [
					{
						role: 'user',
						parts: [
							{
								inlineData: {
									data: base64Audio,
									mimeType: 'audio/webm'
								}
							},
							{
								text: 'Transcribe this audio and respond with only the transcribed text. Do not add any other information.'
							}
						]
					}
				]
			})

			const transcript = response.text

			if (!transcript) {
				throw new Error('No transcript in Gemini response')
			}

			this.logger.log(`[Gemini Audio] Transcription complete: "${transcript.substring(0, 50)}..."`)

			return transcript.trim()
		} catch (e) {
			this.logger.error(`[Gemini Audio] Transcription failed: ${(e as Error).message}`)

			throw new Error(`Gemini Audio STT failed: ${(e as Error).message}`)
		}
	}

	async transcribeAudioWithGeminiAnalysis(buffer: Buffer): Promise<{
		text: string
		language: string
		sentiment: string
		summary: string
	}> {
		try {
			this.logger.log(`[Gemini Audio] Transcribing with analysis: ${buffer.length} bytes`)

			const base64Audio = buffer.toString('base64')
			const model = this.google.getGenerativeModel({ model: 'gemini-2.5-flash' })

			const response = await model.generateContent([
				{
					inlineData: {
						mimeType: 'audio/webm',
						data: base64Audio
					}
				},
				{
					text: `Analyze this audio and provide:
1. Full transcription of the speech
2. Detected language
3. Overall sentiment (positive/negative/neutral)
4. Brief summary in 1-2 sentences
Format your response as JSON:
{
  "text": "full transcription",
  "language": "detected language",
  "sentiment": "sentiment",
  "summary": "brief summary"
}`
				}
			])

			const responseText = response.response.text()
			const jsonMatch = responseText.match(/\{[\s\S]*\}/)

			if (!jsonMatch) {
				throw new Error('Failed to parse Gemini response')
			}

			const analysisResult = JSON.parse(jsonMatch[0])

			this.logger.log(
				`[Gemini Audio] Analysis complete: "${analysisResult.text.substring(0, 50)}..." (${analysisResult.sentiment})`
			)

			return analysisResult
		} catch (e) {
			this.logger.error(`[Gemini Audio] Analysis failed: ${(e as Error).message}`)

			throw new Error(`Gemini Audio analysis failed: ${(e as Error).message}`)
		}
	}

	async transcribeWithFallback(
		buffer: Buffer,
		primaryProvider: 'whisper' | 'gemini' = 'whisper'
	): Promise<{
		text: string
		provider: 'whisper' | 'gemini'
		isFallback: boolean
	}> {
		try {
			if (primaryProvider === 'whisper') {
				try {
					this.logger.log(`[Fallback] Trying Whisper (primary)...`)

					const text = await this.transcribeAudioFromBuffer(buffer)

					return {
						text,
						provider: 'whisper',
						isFallback: false
					}
				} catch (whisperError) {
					this.logger.warn(`[Fallback] Whisper failed, trying Gemini...`)

					const text = await this.transcribeAudioWithGemini(buffer)

					return {
						text,
						provider: 'gemini',
						isFallback: true
					}
				}
			} else {
				try {
					this.logger.log(`[Fallback] Trying Gemini (primary)...`)

					const text = await this.transcribeAudioWithGemini(buffer)

					return {
						text,
						provider: 'gemini',
						isFallback: false
					}
				} catch (geminiError) {
					this.logger.warn(`[Fallback] Gemini failed, trying Whisper...`)

					const text = await this.transcribeAudioFromBuffer(buffer)

					return {
						text,
						provider: 'whisper',
						isFallback: true
					}
				}
			}
		} catch (e) {
			this.logger.error(`[Fallback] Both providers failed: ${(e as Error).message}`)

			throw new Error(`STT failed with all providers: ${(e as Error).message}`)
		}
	}

	async compareProviders(buffer: Buffer): Promise<{
		whisper: {
			text: string
			confidence: number
		}
		gemini: {
			text: string
			analysis: {
				language: string
				sentiment: string
				summary: string
			}
		}
		similarity: number
	}> {
		try {
			this.logger.log(`[Compare] Running both providers...`)

			const [whisper, gemini] = await Promise.all([
				this.transcribeAudioWithConfidence(buffer),
				this.transcribeAudioWithGeminiAnalysis(buffer)
			])

			const similarity = this.calculateSimilarity(whisper.text, gemini.text)

			this.logger.log(`[Compare] Similarity: ${(similarity * 100).toFixed(2)}%`)

			return {
				whisper: whisper,
				gemini: {
					text: gemini.text,
					analysis: {
						language: gemini.language,
						sentiment: gemini.sentiment,
						summary: gemini.summary
					}
				},
				similarity
			}
		} catch (e) {
			this.logger.error(`[Compare] Comparison failed: ${(e as Error).message}`)

			throw new Error(`Provider comparison failed: ${(e as Error).message}`)
		}
	}

	private estimateConfidence(text: string): number {
		let confidence = 0.8

		if (text.length < 10) confidence -= 0.1
		if (text.length > 100) confidence += 0.1

		const commonWords = text.split(' ').filter((word) => word.length > 3)

		if (commonWords.length / text.split(' ').length > 0.6) {
			confidence += 0.05
		}

		return Math.min(Math.max(confidence, 0), 1)
	}

	private calculateSimilarity(text1: string, text2: string): number {
		const shorter = text1.length <= text2.length ? text1 : text2
		const longer = text1.length > text2.length ? text1 : text2

		const distance = this.levenshteinDistance(shorter, longer)
		const maxLength = longer.length

		return (maxLength - distance) / maxLength
	}

	private levenshteinDistance(str1: string, str2: string): number {
		const matrix: number[][] = []

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i]
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1]
				} else {
					matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
				}
			}
		}

		return matrix[str2.length][str1.length]
	}
}
