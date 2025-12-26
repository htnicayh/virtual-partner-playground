import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Conversation } from './conversation.model'

@Entity('users')
export class User {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column({ unique: true })
	email: string

	@Column()
	name: string

	@Column({ nullable: true })
	passwordHash: string

	@Column({ default: 'en' })
	language: string

	@Column({ default: 'beginner' })
	level: string // beginner, intermediate, advanced

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	@OneToMany(() => Conversation, (conv) => conv.user)
	conversations: Conversation[]
}
