import { SessionResponseDto } from './session-response.dto'

export class SessionsListResponseDto {
	sessions: SessionResponseDto[]
	total: number
}
