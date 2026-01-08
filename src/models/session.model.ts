import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { User } from './user.model'

@Entity('sessions')
export class Session {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column({ name: 'user_id', type: 'uuid' })
	userId: string

	@Column({ name: 'socket_id', type: 'varchar', length: 255 })
	socketId: string

	@Column({ name: 'session_token', type: 'varchar', length: 255, unique: true, nullable: true })
	sessionToken: string | null

	@Column({ name: 'ip_address', type: 'inet', nullable: true })
	ipAddress: string | null

	@Column({ name: 'user_agent', type: 'text', nullable: true })
	userAgent: string | null

	@Column({ name: 'is_active', type: 'boolean', default: true })
	isActive: boolean

	@Column({ name: 'connected_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
	connectedAt: Date

	@Column({ name: 'disconnected_at', type: 'timestamp', nullable: true })
	disconnectedAt: Date | null

	@Column({ name: 'last_activity_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
	lastActivityAt: Date

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date

	@ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'user_id' })
	user: User
}
