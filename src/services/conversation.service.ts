import { Injectable } from '@nestjs/common'

@Injectable()
export class ConversationService {
	constructor() {}

	async createConversation(userId: string, dto: unknown) {}

	async getConversation(id: string) {}

	async getUserConversations(userId: string) {}

	async addMessage(
		conversationId: string,
		role: 'user' | 'assistant',
		content: string,
		audioUrl?: string,
		audioResponseUrl?: string,
		llmProvider?: 'openai' | 'gemini'
	) {}

	async getConversationMessages(conversationId: string, limit: number = 50) {}

	async deleteConversation(id: string): Promise<void> {}

	async updateConversationTitle(id: string, title: string) {}
}
