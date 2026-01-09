export class ConversationResponseDto {
	id: string
	conversationId: string
	status: string
	startedAt: Date
	endedAt: Date | null
	durationSeconds: number | null
	totalMessages: number
	userMessages: number
	aiMessages: number
}
