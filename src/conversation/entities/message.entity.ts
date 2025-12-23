export class Message {
	id: string
	conversationId: string
	role: 'user' | 'assistant'
	content: string
	timestamp: Date

	constructor(id: string, conversationId: string, role: 'user' | 'assistant', content: string) {
		this.id = id
		this.conversationId = conversationId
		this.role = role
		this.content = content
		this.timestamp = new Date()
	}

	toJSON() {
		return {
			id: this.id,
			conversationId: this.conversationId,
			role: this.role,
			content: this.content,
			timestamp: this.timestamp
		}
	}
}
