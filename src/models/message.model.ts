import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { AudioChunk } from './audio-chunk.model'
import { Conversation } from './conversation.model'

@Entity('messages')
export class Message {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column({ name: 'conversation_id', type: 'uuid' })
	conversationId: string

	@Column({ type: 'varchar', length: 20 })
	role: string

	@Column({ type: 'text' })
	content: string

	@Column({ name: 'content_type', type: 'varchar', length: 20, default: 'text' })
	contentType: string

	@Column({ name: 'message_index', type: 'int', nullable: true })
	messageIndex: number

	@Column({ name: 'is_final', type: 'boolean', default: false })
	isFinal: boolean

	@Column({ name: 'has_audio', type: 'boolean', default: false })
	hasAudio: boolean

	@Column({ name: 'audio_duration_ms', type: 'int', nullable: true })
	audioDurationMs: number | null

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date

	@ManyToOne(() => Conversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'conversation_id' })
	conversation: Conversation

	@OneToMany(() => AudioChunk, (chunk) => chunk.message)
	audioChunks: AudioChunk[]

	@Column({ name: 'search_vector', type: 'tsvector', nullable: true })
	searchVector: any
}
