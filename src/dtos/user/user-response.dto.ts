export class UserResponseDto {
	userId: string
	sessionToken: string | null
	isAnonymous: boolean
	totalConversations: number
	totalMessages: number
	firstSeenAt: Date
	lastSeenAt: Date
}
