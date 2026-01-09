import { ConversationResponseDto } from './conversation-response.dto'

export class ConversationListResponseDto {
	conversations: ConversationResponseDto[]
	total: number
	limit: number
	offset: number
}
