import { MessageResponseDto } from './message-response.dto'

export class SearchMessagesResponseDto {
	query: string
	messages: MessageResponseDto[]
	total: number
}
