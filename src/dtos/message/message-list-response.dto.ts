import { MessageResponseDto } from './message-response.dto'

export class MessagesListResponseDto {
	conversationId: string
	messages: MessageResponseDto[]
	total: number
}
