import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'

@Injectable()
export class ConversationService {
	private readonly logger = new Logger(ConversationService.name)
	private readonly conversations = new Map<string, Conversation>()
	private readonly messages = new Map<string, Message[]>()

	/**
	 * Creates a new conversation.
	 * @param {string} [userId] - The user ID associated with the conversation.
	 * @returns {Promise<string>} - A promise that resolves to the ID of the created conversation.
	 */
	async createConversation(userId?: string): Promise<string> {
		const conversationId = uuidv4()
		const conversation = new Conversation(conversationId, userId)

		this.conversations.set(conversationId, conversation)
		this.messages.set(conversationId, [])

		this.logger.log(`Conversation created: ${conversationId}`)

		return conversationId
	}

	/**
	 * Adds a new message to a conversation.
	 * @param conversationId - The ID of the conversation to add the message to.
	 * @param role - The role of the message ('user' or 'assistant').
	 * @param content - The content of the message.
	 * @returns A promise that resolves to the ID of the added message.
	 * @throws {NotFoundException} If the conversation with the given ID does not exist.
	 */
	async addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<string> {
		if (!this.conversations.has(conversationId)) {
			throw new NotFoundException(`Conversation ${conversationId} not found`)
		}

		const messageId = uuidv4()
		const message = new Message(messageId, conversationId, role, content)

		const convMessages = this.messages.get(conversationId) || []

		convMessages.push(message)
		this.messages.set(conversationId, convMessages)

		const conversation = this.conversations.get(conversationId)!

		conversation.incrementMessageCount()

		this.logger.debug(`Message added: ${messageId} (${role})`)

		return messageId
	}

	/**
	 * Retrieves the messages associated with a conversation.
	 * @throws {NotFoundException} If the conversation with the given ID does not exist.
	 * @returns A promise that resolves to an array of Message objects containing the messages associated with the conversation.
	 */
	async getMessages(conversationId: string): Promise<Message[]> {
		if (!this.conversations.has(conversationId)) {
			throw new NotFoundException(`Conversation ${conversationId} not found`)
		}

		return this.messages.get(conversationId) || []
	}

	/**
	 * Retrieves the most recent messages from a conversation.
	 * @param conversationId - The ID of the conversation to retrieve the messages from.
	 * @param limit - The maximum number of messages to retrieve. Defaults to 20.
	 * @returns A promise that resolves to an array of Message objects containing the most recent messages.
	 */
	async getRecentMessages(conversationId: string, limit: number = 20): Promise<Message[]> {
		const allMessages = await this.getMessages(conversationId)

		return allMessages.slice(-limit)
	}

	/**
	 * Retrieves a conversation by its ID.
	 * @param conversationId - The ID of the conversation to retrieve.
	 * @returns A promise that resolves to the Conversation object associated with the given ID.
	 * @throws {NotFoundException} If the conversation with the given ID does not exist.
	 */
	async getConversation(conversationId: string): Promise<Conversation> {
		const conv = this.conversations.get(conversationId)

		if (!conv) {
			throw new NotFoundException(`Conversation ${conversationId} not found`)
		}

		return conv
	}

	/**
	 * Retrieves all conversations associated with a given user ID.
	 * @param userId - The ID of the user to retrieve conversations for.
	 * @returns A promise that resolves to an array of Conversation objects associated with the given user ID.
	 */
	async getUserConversations(userId: string): Promise<Conversation[]> {
		const allConversations = Array.from(this.conversations.values())

		return allConversations.filter((c) => c.userId === userId)
	}

	/**
	 * Retrieves all conversations stored in the service.
	 * @returns A promise that resolves to an array of Conversation objects.
	 */
	async getAllConversations(): Promise<Conversation[]> {
		return Array.from(this.conversations.values())
	}

	/**
	 * Deletes a conversation by its ID.
	 * @param conversationId - The ID of the conversation to delete.
	 * @returns A promise that resolves to void when the conversation is deleted.
	 * @throws {NotFoundException} If the conversation with the given ID does not exist.
	 */
	async deleteConversation(conversationId: string): Promise<void> {
		if (!this.conversations.has(conversationId)) {
			throw new NotFoundException(`Conversation ${conversationId} not found`)
		}

		this.conversations.delete(conversationId)
		this.messages.delete(conversationId)
		this.logger.log(`🗑️ Conversation deleted: ${conversationId}`)
	}

	/**
	 * Clears a conversation by its ID.
	 * @param conversationId - The ID of the conversation to clear.
	 * @returns A promise that resolves to void when the conversation is cleared.
	 * @throws {NotFoundException} If the conversation with the given ID does not exist.
	 */
	async clearConversation(conversationId: string): Promise<void> {
		if (!this.conversations.has(conversationId)) {
			throw new NotFoundException(`Conversation ${conversationId} not found`)
		}

		const conversation = this.conversations.get(conversationId)!

		this.messages.set(conversationId, [])

		conversation.messageCount = 0
		conversation.updateTimestamp()

		this.logger.log(`🧹 Conversation cleared: ${conversationId}`)
	}

	/**
	 * Retrieves statistics about a conversation.
	 * @param conversationId - The ID of the conversation to retrieve statistics for.
	 * @returns A promise that resolves to an object containing the conversation statistics.
	 * The object will contain the following properties:
	 * - `conversationId`: The ID of the conversation.
	 * - `totalMessages`: The total number of messages in the conversation.
	 * - `userMessages`: The number of messages sent by the user in the conversation.
	 * - `aiMessages`: The number of messages sent by the AI in the conversation.
	 * - `createdAt`: The timestamp when the conversation was created.
	 * - `updatedAt`: The timestamp when the conversation was last updated.
	 * - `duration`: The duration of the conversation in milliseconds.
	 */
	async getConversationStats(conversationId: string): Promise<any> {
		const conversation = await this.getConversation(conversationId)
		const messages = await this.getMessages(conversationId)

		const userMessages = messages.filter((m) => m.role === 'user')
		const aiMessages = messages.filter((m) => m.role === 'assistant')

		return {
			conversationId,
			totalMessages: messages.length,
			userMessages: userMessages.length,
			aiMessages: aiMessages.length,
			createdAt: conversation.createdAt,
			updatedAt: conversation.updatedAt,
			duration: new Date().getTime() - conversation.createdAt.getTime()
		}
	}
}
