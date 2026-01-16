import { IsEnum, IsNumber, IsOptional } from 'class-validator'

export enum ConversationStatus {
	ACTIVE = 'active',
	ENDED = 'ended',
	INTERRUPTED = 'interrupted'
}

export class UpdateConversationDto {
	@IsOptional()
	@IsEnum(ConversationStatus)
	status?: ConversationStatus

	@IsOptional()
	@IsNumber()
	audioBytes?: number

	@IsOptional()
	@IsNumber()
	audioChunks?: number
}
