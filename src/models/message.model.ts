import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Conversation } from './conversation.model'

@Entity('messages')
export class Message {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column('text')
	content: string

	@Column()
	role: 'user' | 'assistant'

	@Column({ nullable: true })
	audioUrl: string

	@Column({ nullable: true })
	audioResponseUrl: string

	@Column({ nullable: true })
	llmProvider: 'openai' | 'gemini'

	@ManyToOne(() => Conversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
	conversation: Conversation

	@Column()
	conversationId: string

	@CreateDateColumn()
	createdAt: Date
}
