import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'
import { CreateMessageDto } from './create-message.dto'

export class CreateMessagesBatchDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateMessageDto)
	messages: CreateMessageDto[]
}
