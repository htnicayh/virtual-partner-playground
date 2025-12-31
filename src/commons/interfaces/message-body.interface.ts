export interface AudioChunk {
	chunk: string
	chunkIndex: number
	isFinal: boolean
}

export interface StartStream {
	userId: string
	conversationId: string
	sessionId: string
	provider?: 'openai' | 'gemini'
}

export interface EndStream {
	sessionId: string
	streamType?: string
}
