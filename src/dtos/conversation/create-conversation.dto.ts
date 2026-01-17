import { IsOptional, IsString } from 'class-validator'

export class CreateConversationDto {
	@IsString()
	conversationId: string

	@IsOptional()
	@IsString()
	sessionId?: string

	@IsOptional()
	@IsString()
	socketId?: string
}
