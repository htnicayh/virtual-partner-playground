import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Conversation } from './entities/conversation.entity'
import { Message } from './entities/message.entity'

@Injectable()
export class ConversationService {
	private readonly logger = new Logger(ConversationService.name)
	private conversations = new Map<string, Conversation>()
	private messages = new Map<string, Message[]>()

	/**
	 * Create a new conversation
	 */
	async createConversation(userId?: string): Promise<string> {
		const conversationId = uuidv4()
		const conversation = new Conversation(conversationId, userId)

		this.conversations.set(conversationId, conversation)
		this.messages.set(conversationId, [])

		this.logger.log(`📚 Conversation created: ${conversationId}`)
		return conversationId
	}

	/**
	 * Add a message to a conversation
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

		this.logger.debug(`📝 Message added: ${messageId} (${role})`)
		return messageId
	}

	/**
	 * Get all messages in a conversation
	 */
	async getMessages(conversationId: string): Promise<Message[]> {
		if (!this.conversations.has(conversationId)) {
			throw new NotFoundException(`Conversation ${conversationId} not found`)
		}

		return this.messages.get(conversationId) || []
	}

	/**
	 * Get recent messages for context
	 */
	async getRecentMessages(conversationId: string, limit: number = 20): Promise<Message[]> {
		const allMessages = await this.getMessages(conversationId)
		return allMessages.slice(-limit)
	}

	/**
	 * Get conversation details
	 */
	async getConversation(conversationId: string): Promise<Conversation> {
		const conv = this.conversations.get(conversationId)
		if (!conv) {
			throw new NotFoundException(`Conversation ${conversationId} not found`)
		}
		return conv
	}

	/**
	 * Get all conversations for a user
	 */
	async getUserConversations(userId: string): Promise<Conversation[]> {
		const allConversations = Array.from(this.conversations.values())
		return allConversations.filter((c) => c.userId === userId)
	}

	/**
	 * Get all conversations
	 */
	async getAllConversations(): Promise<Conversation[]> {
		return Array.from(this.conversations.values())
	}

	/**
	 * Delete a conversation
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
	 * Clear all messages in a conversation
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
	 * Get conversation statistics
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
