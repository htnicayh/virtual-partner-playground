export class MessageResponseDto {
	id: string
	role: string
	content: string
	contentType: string
	messageIndex: number
	isFinal: boolean
	hasAudio: boolean
	createdAt: Date
}
