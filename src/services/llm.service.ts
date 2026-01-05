import { GoogleGenerativeAI } from '@google/generative-ai'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import { MessagePayload } from '../commons/interfaces/message-payload.interface'

@Injectable()
export class LlmService implements OnModuleInit {
	private openai: OpenAI
	private gemini: GoogleGenerativeAI
	private systemPrompt: string

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
		this.gemini = new GoogleGenerativeAI(googleApiKey)

		this.systemPrompt = `You are an English conversation teacher. 
Your role is to:
1. Engage in natural English conversations
2. Correct grammar and pronunciation errors gently
3. Suggest better ways to phrase sentences
4. Provide explanations for grammar rules
5. Ask follow-up questions to encourage dialogue
6. Adapt your level to the user's proficiency level
Keep responses conversational and encouraging.`
	}

	async generateResponseWithOpenAI(
		messages: MessagePayload[],
		userLevel: string = 'intermediate'
	): Promise<{ response: string; provider: 'openai' }> {
		try {
			const systemMessage = this._addLevelContext(this.systemPrompt, userLevel)

			const response = await this.openai.chat.completions.create({
				model: 'gpt-4o',
				messages: [{ role: 'system', content: systemMessage }, ...messages],
				temperature: 0.7,
				max_tokens: 500
			})

			const content = response.choices[0].message.content || 'No response generated'

			return { response: content, provider: 'openai' }
		} catch (error) {
			throw new Error(`OpenAI API error: ${(error as Error).message}`)
		}
	}

	async generateResponseWithGemini(
		messages: MessagePayload[],
		userLevel: string = 'intermediate'
	): Promise<{ response: string; provider: 'gemini' }> {
		try {
			const systemMessage = this._addLevelContext(this.systemPrompt, userLevel)
			const model = this.gemini.getGenerativeModel({ model: 'gemini-2.5-flash' })

			const formattedMessages = messages.map((msg) => ({
				role: msg.role === 'user' ? 'user' : 'model',
				parts: [{ text: msg.content }]
			}))

			const chat = model.startChat({
				history: formattedMessages.slice(0, -1),
				generationConfig: {
					maxOutputTokens: 500,
					temperature: 0.7
				},
				systemInstruction: {
					role: 'user',
					parts: [{ text: systemMessage }]
				}
			})

			const result = await chat.sendMessage(formattedMessages[formattedMessages.length - 1].parts[0].text)
			const content = result.response.text()

			return { response: content, provider: 'gemini' }
		} catch (error) {
			throw new Error(`Gemini API error: ${(error as Error).message}`)
		}
	}

	async generateResponse(
		messages: MessagePayload[],
		userLevel: string = 'intermediate',
		provider: 'openai' | 'gemini' = 'openai'
	): Promise<{ response: string; provider: 'openai' | 'gemini' }> {
		if (provider === 'gemini') {
			return this.generateResponseWithGemini(messages, userLevel)
		}

		return this.generateResponseWithOpenAI(messages, userLevel)
	}

	private _addLevelContext(prompt: string, level: string): string {
		let levelGuide = ''

		switch (level.toLowerCase()) {
			case 'beginner':
				levelGuide = 'Use simple sentences, basic vocabulary. Explain new words.'
				break
			case 'intermediate':
				levelGuide = 'Use moderate vocabulary. Introduce some idioms and complex sentences.'
				break
			case 'advanced':
				levelGuide = 'Use advanced vocabulary, idiomatic expressions, and complex sentence structures.'
				break
		}

		return `${prompt}\nUser Level: ${level}\n${levelGuide}`
	}
}
