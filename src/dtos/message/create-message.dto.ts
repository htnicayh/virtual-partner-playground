import { IsString, IsEnum, IsBoolean, IsNumber, IsOptional } from 'class-validator'

export enum MessageRole {
	USER = 'user',
	ASSISTANT = 'assistant'
}

export enum MessageType {
	TEXT = 'text',
	AUDIO = 'audio',
	BOTH = 'both'
}

export class CreateMessageDto {
	@IsString()
	conversationId: string

	@IsEnum(MessageRole)
	role: MessageRole

	@IsString()
	content: string

	@IsOptional()
	@IsEnum(MessageType)
	contentType?: MessageType

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
