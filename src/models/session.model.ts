import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity('sessions')
export class Session {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column()
	userId: string

	@Column()
	conversationId: string

	@Column({ default: 'active' })
	status: 'active' | 'idle' | 'processing'

	@Column({ nullable: true })
	lastActivityAt: Date

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date
}
