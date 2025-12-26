export interface AudioSession {
	clientId: string
	sessionId: string
	conversationId: string
	audioChunks: Buffer[]
	totalChunksReceived: number
	totalBytes: number
	lastChunkReceivedAt: number
	startTime: number
	isComplete: boolean
}
