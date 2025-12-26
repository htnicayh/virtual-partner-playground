import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { Conversation } from '../models/conversation.model'
import { Message } from '../models/message.model'
import { Session } from '../models/session.model'
import { User } from '../models/user.model'

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
	type: 'postgres',
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '5432'),
	username: process.env.DB_USERNAME || 'postgres',
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME || 'virtual_partner',
	entities: [User, Conversation, Message, Session],
	synchronize: process.env.DB_SYNCHRONIZE === 'true',
	logging: process.env.DB_LOGGING === 'true',
	ssl: process.env.NODE_ENV === 'production'
})

export const getDatabaseModels = () => [User, Conversation, Message, Session]
