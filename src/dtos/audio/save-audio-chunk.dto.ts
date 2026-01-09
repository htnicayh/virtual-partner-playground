import { IsString, IsNumber, IsOptional } from 'class-validator'

export class SaveAudioChunkDto {
	@IsString()
	messageId: string

	@IsString()
	conversationId: string

	@IsString()
	chunkData: string

	@IsNumber()
	chunkIndex: number

	@IsOptional()
	@IsString()
	mimeType?: string

	@IsNumber()
	byteSize: number
}
