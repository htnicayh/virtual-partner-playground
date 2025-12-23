import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { ChatCompletionMetadata } from 'src/common/interfaces/chat.interface'

@Injectable()
export class OpenaiService {
	private readonly logger = new Logger(OpenaiService.name)

	private readonly openai: OpenAI
	private readonly model: string
	private readonly ttsVoice: string

	constructor(private readonly configService: ConfigService) {
		const endpoint = this.configService.get<string>('OPENAI_BASE_ENDPOINT')
		const apiKey = this.configService.get<string>('OPENAI_API_KEY')

		if (!apiKey) {
			throw new Error('OPENAI_API_KEY not configured')
		}

		this.openai = new OpenAI({ baseURL: endpoint, apiKey })
		this.model = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini'
		this.ttsVoice = this.configService.get<string>('OPENAI_TTS_VOICE') || 'nova'

		this.logger.log(`* OpenAI initialized`)
		this.logger.log(`* Model: ${this.model}`)
		this.logger.log(`* TTS Voice: ${this.ttsVoice}`)
	}

	/**
	 * Generates a chat response from the OpenAI API.
	 * @param messages - An array of objects containing the role and content of the message.
	 * @param systemPrompt - The system prompt to generate the chat response with.
	 * @returns A promise that resolves to an object containing the chat response and metadata.
	 */
	async generateChatResponse(
		messages: Array<{ role: string; content: string }>,
		systemPrompt: string
	): Promise<{ response: string; metadata: ChatCompletionMetadata }> {
		try {
			this.logger.debug(`Generating chat response with ${messages.length} messages`)

			const response = await this.openai.chat.completions.create({
				model: this.model,
				messages: [{ role: 'system', content: systemPrompt }, ...messages] as OpenAI.Chat.ChatCompletionMessageParam[],
				temperature: 0.7,
				max_tokens: 500,
				top_p: 0.9
			})

			const aiMessage = response.choices[0]?.message?.content || ''

			if (!aiMessage) {
				throw new Error('No response from OpenAI')
			}

			const metadata: ChatCompletionMetadata = {
				inputTokens: response.usage?.prompt_tokens || 0,
				outputTokens: response.usage?.completion_tokens || 0,
				totalTokens: response.usage?.total_tokens || 0
			}

			this.logger.debug(`Chat response generated (${metadata.totalTokens} tokens)`)

			return { response: aiMessage, metadata }
		} catch (e: any) {
			this.logger.error(`Chat error: ${e.message}`)

			throw e
		}
	}

	/**
	 * Converts speech to text using the OpenAI Whisper STT model.
	 * @param audioBuffer The audio data to transcribe as a Buffer.
	 * @param language The language of the audio data. Defaults to 'en'.
	 * @returns A promise that resolves to the transcribed text.
	 */
	async speechToText(audioBuffer: Buffer, language: string = 'en'): Promise<string> {
		try {
			this.logger.debug(`Converting speech to text (${audioBuffer.length} bytes)`)

			const response = await this.openai.audio.transcriptions.create({
				file: new File([audioBuffer as any], 'audio.wav', { type: 'audio/wav' }),
				model: 'whisper-1',
				language,
				temperature: 0.2
			} as any)

			const transcription = response.text?.trim()

			if (!transcription) {
				throw new Error('Could not transcribe audio')
			}

			this.logger.debug(`Transcription: "${transcription}"`)

			return transcription
		} catch (e: any) {
			this.logger.error(`STT error: ${e.message}`)

			throw e
		}
	}

	/**
	 * Converts text to speech using the OpenAI TTS model.
	 * @param text The text to convert to speech.
	 * @returns A promise that resolves to a base64-encoded audio string.
	 */
	async textToSpeech(text: string): Promise<string> {
		try {
			this.logger.debug(`Converting text to speech (${text.length} chars)`)

			const response = await this.openai.audio.speech.create({
				model: 'tts-1',
				voice: this.ttsVoice as any,
				input: text,
				speed: 0.95
			})

			const buffer = Buffer.from(await response.arrayBuffer())
			const audioBase64 = buffer.toString('base64')

			this.logger.debug(`TTS audio generated (${audioBase64.length} bytes)`)

			return audioBase64
		} catch (e: any) {
			this.logger.error(`TTS error: ${e.message}`)

			throw e
		}
	}

	/**
	 * Get current model
	 */
	getModel(): string {
		return this.model
	}

	/**
	 * Get available TTS voices
	 */
	getAvailableVoices(): string[] {
		return ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']
	}
}
