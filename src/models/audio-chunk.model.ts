import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Message } from './message.model'
import { Conversation } from './conversation.model'

@Entity('audio_chunks')
export class AudioChunk {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column({ name: 'message_id', type: 'uuid' })
	messageId: string

	@Column({ name: 'conversation_id', type: 'uuid' })
	conversationId: string

	@Column({ name: 'chunk_data', type: 'text' })
	chunkData: string

	@Column({ name: 'chunk_index', type: 'int' })
	chunkIndex: number

	@Column({ name: 'mime_type', type: 'varchar', length: 100, default: 'audio/pcm;rate=24000' })
	mimeType: string

	@Column({ name: 'byte_size', type: 'int', nullable: true })
	byteSize: number | null

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date

	@ManyToOne(() => Message, (message) => message.audioChunks, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'message_id' })
	message: Message

	@ManyToOne(() => Conversation, (conversation) => conversation.audioChunks, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'conversation_id' })
	conversation: Conversation
}
