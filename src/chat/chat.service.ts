import { Injectable, Logger, BadRequestException } from '@nestjs/common'
import { OpenaiService } from '../openai/openai.service'
import { ConversationService } from '../conversation/conversation.service'

interface ProcessMessageResponse {
	aiMessage: string
	conversationId: string
	messageId: string
	metadata: {
		inputTokens: number
		outputTokens: number
		processingTime: number
	}
}

@Injectable()
export class ChatService {
	private readonly logger = new Logger(ChatService.name)

	private systemPrompt = `You are an expert English conversation partner and tutor.

Your responsibilities:
1. Engage in natural, encouraging English conversation
2. Gently correct grammar and pronunciation errors
3. Suggest vocabulary improvements
4. Ask follow-up questions to keep conversation flowing
5. Adapt difficulty based on user's level
6. Be supportive and motivating
7. Track common mistakes and reinforce learning

Conversation Guidelines:
- Use a conversational tone, not robotic
- Mix simple and advanced vocabulary naturally
- Provide explanations when correcting
- Ask open-ended questions
- Encourage elaboration on topics
- Be warm and encouraging

When correcting errors, use this format:
"You said: [incorrect phrase]
Better: [corrected phrase]
Reason: [brief explanation]"

Keep responses focused and under 150 words for better learning flow.`

	constructor(
		private openaiService: OpenaiService,
		private conversationService: ConversationService
	) {}

	/**
	 * Processes a text message and returns the response from the AI.
	 * @param userMessage The text message to process.
	 * @param conversationId The ID of the conversation to process the message in. Optional.
	 * @param userId The ID of the user sending the message. Optional.
	 * @returns A promise that resolves to an object containing the AI's response, the conversation ID, and the message ID.
	 * @throws BadRequestException If the message is empty or not provided.
	 */
	async processTextMessage(
		userMessage: string,
		conversationId?: string,
		userId?: string
	): Promise<ProcessMessageResponse> {
		const startTime = Date.now()

		try {
			if (!userMessage || userMessage.trim().length === 0) {
				throw new BadRequestException('Message cannot be empty')
			}

			let convId = conversationId
			if (!convId) {
				convId = await this.conversationService.createConversation(userId)
			}

			await this.conversationService.getConversation(convId)

			const history = await this.conversationService.getRecentMessages(convId, 20)

			const messages = history.map((msg) => ({
				role: msg.role,
				content: msg.content
			}))

			messages.push({
				role: 'user',
				content: userMessage
			})

			const { response: aiMessage, metadata } = await this.openaiService.generateChatResponse(
				messages,
				this.systemPrompt
			)

			const aiMessageId = await this.conversationService.addMessage(convId, 'assistant', aiMessage)

			const processingTime = Date.now() - startTime

			this.logger.log(`Text message processed (${metadata.totalTokens} tokens, ${processingTime}ms)`)

			return {
				aiMessage,
				conversationId: convId,
				messageId: aiMessageId,
				metadata: {
					inputTokens: metadata.inputTokens,
					outputTokens: metadata.outputTokens,
					processingTime
				}
			}
		} catch (e: any) {
			this.logger.error(`Error processing text message: ${e.message}`)

			throw e
		}
	}

	/**
	 * Processes a voice message and returns the response from the AI.
	 * @param audioBase64 The audio data to transcribe as a base64-encoded string.
	 * @param conversationId The ID of the conversation to process the message in. Optional.
	 * @param userId The ID of the user sending the message. Optional.
	 * @returns A promise that resolves to an object containing the user's transcription, AI's response, and the base64-encoded audio response.
	 * @throws BadRequestException If the audio data is empty or not provided.
	 */
	async processVoiceMessage(
		audioBase64: string,
		conversationId?: string,
		userId?: string
	): Promise<{
		userTranscription: string
		aiMessage: string
		audioBase64: string
		conversationId: string
		messageId: string
		metadata: {
			inputTokens: number
			outputTokens: number
			processingTime: number
		}
	}> {
		try {
			if (!audioBase64 || audioBase64.length === 0) {
				throw new BadRequestException('Audio data is required')
			}

			const startTime = Date.now()

			this.logger.log('Converting speech to text...')

			const audioBuffer = Buffer.from(audioBase64, 'base64')
			const userTranscription = await this.openaiService.speechToText(audioBuffer)

			const processedMessage = await this.processTextMessage(userTranscription, conversationId, userId)

			this.logger.log('Converting response to speech...')

			const responseAudio = await this.openaiService.textToSpeech(processedMessage.aiMessage)

			const processingTime = Date.now() - startTime

			this.logger.log(`Voice message processed (${processingTime}ms)`)

			return {
				userTranscription,
				aiMessage: processedMessage.aiMessage,
				audioBase64: responseAudio,
				conversationId: processedMessage.conversationId,
				messageId: processedMessage.messageId,
				metadata: {
					inputTokens: processedMessage.metadata.inputTokens,
					outputTokens: processedMessage.metadata.outputTokens,
					processingTime
				}
			}
		} catch (e: any) {
			this.logger.error(`Error processing voice message: ${e.message}`)

			throw e
		}
	}

	/**
	 * Retrieves the conversation history for a given conversation ID.
	 * @param conversationId - The ID of the conversation to retrieve the history for.
	 * @returns A promise that resolves to an array of objects containing the conversation history.
	 */
	async getConversationHistory(conversationId: string): Promise<any[]> {
		const messages = await this.conversationService.getMessages(conversationId)

		return messages.map((msg) => msg.toJSON())
	}

	/**
	 * Get system prompt
	 */
	getSystemPrompt(): string {
		return this.systemPrompt
	}

	/**
	 * Update system prompt
	 */
	updateSystemPrompt(newPrompt: string): void {
		this.systemPrompt = newPrompt

		this.logger.log('System prompt updated')
	}
}
