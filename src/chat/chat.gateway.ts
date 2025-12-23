import { BadRequestException, Logger } from '@nestjs/common'
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { ChatService } from './chat.service'
import { GetConversationHistoryDto, TextMessageDto, VoiceMessageDto } from './dtos/chat.dto'

@WebSocketGateway({
	cors: { origin: '*' },
	namespace: 'chat',
	transports: ['websocket']
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
	private readonly logger = new Logger(ChatGateway.name)

	@WebSocketServer()
	server: Server

	constructor(private chatService: ChatService) {}

	/**
	 * Handle client connection
	 */
	handleConnection(client: Socket) {
		this.logger.log(`✅ Client connected: ${client.id}`)

		client.emit('connected', {
			message: 'Connected to English Partner server',
			clientId: client.id,
			timestamp: new Date()
		})
	}

	/**
	 * Handle client disconnection
	 */
	handleDisconnect(client: Socket) {
		this.logger.log(`❌ Client disconnected: ${client.id}`)
	}

	/**
	 * Handle text message event
	 */
	@SubscribeMessage('text-message')
	async handleTextMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: TextMessageDto) {
		try {
			if (!payload.message || payload.message.trim().length === 0) {
				throw new BadRequestException('Message cannot be empty')
			}

			this.logger.log(`📝 Text message from ${client.id}: "${payload.message}"`)

			const response = await this.chatService.processTextMessage(payload.message, payload.conversationId, client.id)

			client.emit('text-response', {
				response: response.aiMessage,
				conversationId: response.conversationId,
				messageId: response.messageId,
				timestamp: new Date(),
				metadata: response.metadata
			})

			this.logger.debug(`✅ Text response sent to ${client.id} (${response.metadata.processingTime}ms)`)
		} catch (e: any) {
			this.logger.error(`❌ Error handling text message: ${e.message}`)
			client.emit('error', {
				message: e.message || 'Failed to process message',
				code: e.code || 'TEXT_MESSAGE_ERROR',
				timestamp: new Date()
			})
		}
	}

	/**
	 * Handle voice message event
	 */
	@SubscribeMessage('voice-message')
	async handleVoiceMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: VoiceMessageDto) {
		try {
			if (!payload.audioBase64 || payload.audioBase64.length === 0) {
				throw new BadRequestException('Audio data is required')
			}

			this.logger.log(`🎤 Voice message from ${client.id} (${payload.audioBase64.length} bytes)`)

			const response = await this.chatService.processVoiceMessage(
				payload.audioBase64,
				payload.conversationId,
				client.id
			)

			client.emit('voice-response', {
				userTranscription: response.userTranscription,
				aiMessage: response.aiMessage,
				audioBase64: response.audioBase64,
				conversationId: response.conversationId,
				messageId: response.messageId,
				timestamp: new Date(),
				metadata: response.metadata
			})

			this.logger.debug(`✅ Voice response sent to ${client.id} (${response.metadata.processingTime}ms)`)
		} catch (e: any) {
			this.logger.error(`❌ Error handling voice message: ${e.message}`)
			client.emit('error', {
				message: e.message || 'Failed to process voice message',
				code: e.code || 'VOICE_MESSAGE_ERROR',
				timestamp: new Date()
			})
		}
	}

	/**
	 * Handle get conversation history event
	 */
	@SubscribeMessage('get-conversation-history')
	async handleGetConversationHistory(
		@ConnectedSocket() client: Socket,
		@MessageBody() payload: GetConversationHistoryDto
	) {
		try {
			if (!payload.conversationId) {
				throw new BadRequestException('Conversation ID is required')
			}

			this.logger.log(`📚 Get history for conversation: ${payload.conversationId}`)

			const history = await this.chatService.getConversationHistory(payload.conversationId)

			client.emit('conversation-history', {
				conversationId: payload.conversationId,
				messages: history,
				count: history.length,
				timestamp: new Date()
			})

			this.logger.debug(`✅ History sent to ${client.id} (${history.length} messages)`)
		} catch (e: any) {
			this.logger.error(`❌ Error getting conversation history: ${e.message}`)
			client.emit('error', {
				message: e.message || 'Failed to fetch history',
				code: e.code || 'HISTORY_ERROR',
				timestamp: new Date()
			})
		}
	}

	/**
	 * Health check event
	 */
	@SubscribeMessage('ping')
	handlePing(@ConnectedSocket() client: Socket) {
		this.logger.debug(`ping from ${client.id}`)
		client.emit('pong', { timestamp: new Date() })
	}
}
