export interface StreamingSession {
	userId: string
	conversationId: string
	audioChunks: Buffer[]
	isStreaming: boolean
	startTime: number
	provider: 'openai' | 'gemini'
	totalBytes: number
}
