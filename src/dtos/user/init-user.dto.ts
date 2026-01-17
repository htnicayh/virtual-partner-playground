import { IsObject, IsOptional, IsString } from 'class-validator'

export class InitUserDto {
	@IsOptional()
	@IsObject()
	fingerprint?: any

	@IsOptional()
	@IsString()
	sessionToken?: string
}
