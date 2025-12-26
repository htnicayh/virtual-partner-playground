import {
	Column,
	CreateDateColumn,
	Entity,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from 'typeorm'
import { Message } from './message.model'
import { User } from './user.model'

@Entity('conversations')
export class Conversation {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column()
	title: string

	@Column({ nullable: true })
	topic: string

	@ManyToOne(() => User, (user) => user.conversations, { onDelete: 'CASCADE' })
	user: User

	@Column()
	userId: string

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	@OneToMany(() => Message, (msg) => msg.conversation)
	messages: Message[]
}
