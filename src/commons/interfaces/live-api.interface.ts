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
	outputAudioTranscription?: any
	inputAudioTranscription?: any
}
