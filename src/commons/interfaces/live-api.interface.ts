export interface LiveSession {
	clientId: string
	session: any
	audioQueue: Buffer[]
	conversationHistory: any[]
	createdAt: number
	isActive: boolean
}

export interface LiveAPIConfig {
	model: string
	responseModalities: string[]
	systemInstruction: string
}

export interface ServerContent {
	modelTurn?: {
		parts: Array<{
			text?: string
			inlineData?: {
				data: string
				mimeType: string
			}
		}>
	}
	userContent?: {
		parts: Array<{
			text?: string
		}>
	}
	interrupted?: boolean
	turnComplete?: boolean
}

export interface LiveAPIMessage {
	serverContent?: ServerContent
	toolCall?: any
	toolCallCancellation?: any
}
