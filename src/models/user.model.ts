import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Conversation } from './conversation.model'
import { Session } from './session.model'

@Entity('users')
export class User {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column({ name: 'anonymous_id', type: 'varchar', length: 255, unique: true, nullable: true })
	anonymousId: string | null

	@Column({ name: 'session_token', type: 'varchar', length: 255, unique: true, nullable: true })
	sessionToken: string | null

	@Column({ type: 'varchar', length: 255, unique: true, nullable: true })
	email: string | null

	@Column({ type: 'varchar', length: 100, nullable: true })
	username: string | null

	@Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
	passwordHash: string | null

	@Column({ name: 'is_anonymous', type: 'boolean', default: true })
	isAnonymous: boolean

	@Column({ name: 'first_seen_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
	firstSeenAt: Date

	@Column({ name: 'last_seen_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
	lastSeenAt: Date

	@Column({ name: 'total_conversations', type: 'int', default: 0 })
	totalConversations: number

	@Column({ name: 'total_messages', type: 'int', default: 0 })
	totalMessages: number

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt: Date

	@OneToMany(() => Conversation, (conversation) => conversation.user)
	conversations: Conversation[]

	@OneToMany(() => Session, (session) => session.user)
	sessions: Session[]
}
