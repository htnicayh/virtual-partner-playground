import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from 'typeorm'
import { AudioChunk } from './audio-chunk.model'
import { Message } from './message.model'
import { User } from './user.model'

@Entity('conversations')
export class Conversation {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column({ name: 'user_id', type: 'uuid' })
	userId: string

	@Column({ name: 'conversation_id', type: 'varchar', length: 255, unique: true })
	conversationId: string

	@Column({ name: 'session_id', type: 'varchar', length: 255, nullable: true })
	sessionId: string | null

	@Column({ name: 'socket_id', type: 'varchar', length: 255, nullable: true })
	socketId: string | null

	@Column({ type: 'varchar', length: 50, default: 'active' })
	status: string

	@Column({ name: 'started_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
	startedAt: Date

	@Column({ name: 'ended_at', type: 'timestamp', nullable: true })
	endedAt: Date | null

	@Column({ name: 'duration_seconds', type: 'int', nullable: true })
	durationSeconds: number | null

	@Column({ name: 'total_messages', type: 'int', default: 0 })
	totalMessages: number

	@Column({ name: 'user_messages', type: 'int', default: 0 })
	userMessages: number

	@Column({ name: 'ai_messages', type: 'int', default: 0 })
	aiMessages: number

	@Column({ name: 'total_audio_bytes', type: 'bigint', default: 0 })
	totalAudioBytes: number

	@Column({ name: 'total_audio_chunks', type: 'int', default: 0 })
	totalAudioChunks: number

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt: Date

	@ManyToOne(() => User, (user) => user.conversations, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User

	@OneToMany(() => Message, (message) => message.conversation)
	messages: Message[]

	@OneToMany(() => AudioChunk, (chunk) => chunk.conversation)
	audioChunks: AudioChunk[]
}
