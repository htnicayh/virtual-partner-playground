import { IsString, IsOptional } from 'class-validator'

export class CreateSessionDto {
	@IsString()
	socketId: string

	@IsOptional()
	@IsString()
	ipAddress?: string

	@IsOptional()
	@IsString()
	userAgent?: string
}
