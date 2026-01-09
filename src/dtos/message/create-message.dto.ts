import { IsString, IsEnum, IsBoolean, IsNumber, IsOptional } from 'class-validator'

export class CreateMessageDto {
	@IsString()
	conversationId: string

	@IsEnum(['user', 'assistant'])
	role: 'user' | 'assistant'

	@IsString()
	content: string

	@IsOptional()
	@IsEnum(['text', 'audio', 'both'])
	contentType?: 'text' | 'audio' | 'both'

	@IsOptional()
	@IsBoolean()
	isFinal?: boolean

	@IsOptional()
	@IsBoolean()
	hasAudio?: boolean

	@IsOptional()
	@IsNumber()
	audioDurationMs?: number
}
