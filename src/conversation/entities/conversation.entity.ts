export class Conversation {
	id: string
	userId?: string
	createdAt: Date
	updatedAt: Date
	messageCount: number

	constructor(id: string, userId?: string) {
		this.id = id
		this.userId = userId
		this.createdAt = new Date()
		this.updatedAt = new Date()
		this.messageCount = 0
	}

	updateTimestamp() {
		this.updatedAt = new Date()
	}

	incrementMessageCount() {
		this.messageCount++
		this.updateTimestamp()
	}

	toJSON() {
		return {
			id: this.id,
			userId: this.userId,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
			messageCount: this.messageCount
		}
	}
}
