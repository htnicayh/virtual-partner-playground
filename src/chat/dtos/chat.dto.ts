import { IsString, IsOptional, IsNotEmpty } from 'class-validator'

export class TextMessageDto {
	@IsString()
	@IsNotEmpty()
	message: string

	@IsOptional()
	@IsString()
	conversationId?: string
}

export class VoiceMessageDto {
	@IsString()
	@IsNotEmpty()
	audioBase64: string

	@IsOptional()
	@IsString()
	mimeType?: string

	@IsOptional()
	@IsString()
	conversationId?: string
}

export class GetConversationHistoryDto {
	@IsString()
	@IsNotEmpty()
	conversationId: string
}

export class MessageMetadataDto {
	inputTokens: number
	outputTokens: number
	totalTokens: number
	processingTime: number
}

export class TextResponseDto {
	response: string
	conversationId: string
	messageId: string
	timestamp: Date
	metadata: MessageMetadataDto
}

export class VoiceResponseDto {
	userTranscription: string
	aiMessage: string
	audioBase64: string
	conversationId: string
	messageId: string
	timestamp: Date
	metadata: MessageMetadataDto
}

export class ConversationMessageDto {
	id: string
	role: 'user' | 'assistant'
	content: string
	timestamp: Date
}

export class ConversationHistoryDto {
	conversationId: string
	messages: ConversationMessageDto[]
	count: number
	timestamp: Date
}

export class ErrorResponseDto {
	message: string
	code: string
	timestamp?: Date
}

export class ConnectedResponseDto {
	message: string
	clientId: string
	timestamp: Date
}
