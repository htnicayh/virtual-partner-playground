import { IsEnum, IsNumber, IsOptional } from 'class-validator'

export class UpdateConversationDto {
	@IsOptional()
	@IsEnum(['active', 'ended', 'interrupted'])
	status?: 'active' | 'ended' | 'interrupted'

	@IsOptional()
	@IsNumber()
	audioBytes?: number

	@IsOptional()
	@IsNumber()
	audioChunks?: number
}
