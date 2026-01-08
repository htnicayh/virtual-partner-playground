import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { AudioChunk } from '../models/audio-chunk.model'
import { Conversation } from '../models/conversation.model'
import { Message } from '../models/message.model'
import { Session } from '../models/session.model'
import { User } from '../models/user.model'

import 'dotenv/config'

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
	type: 'postgres',
	host: process.env.DATABASE_HOST || 'localhost',
	port: parseInt(process.env.DATABASE_PORT || '5432'),
	username: process.env.DATABASE_USERNAME || 'postgres',
	password: process.env.DATABASE_PASSWORD,
	database: process.env.DATABASE_NAME || 'postgres',
	entities: [User, Conversation, Message, Session, AudioChunk],
	synchronize: process.env.DATABASE_SYNCHRONIZE === 'false',
	logging: process.env.DATABASE_LOGGING === 'true',
	ssl: false,
	extra: {
		ssl: {
			rejectUnauthorized: false
		}
	}
})

export const getDatabaseModels = () => [User, Conversation, Message, Session, AudioChunk]
