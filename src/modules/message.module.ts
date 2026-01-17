import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SessionGuard } from '../commons/guards/session.guard'
import { MessageController } from '../controllers/message.controller'
import { Conversation, Message } from '../models'
import { MessageService } from '../services/message.service'
import { ConversationModule } from './conversation.module'
import { UserModule } from './user.module'

@Module({
	imports: [TypeOrmModule.forFeature([Message, Conversation]), UserModule, ConversationModule],
	controllers: [MessageController],
	providers: [MessageService, SessionGuard],
	exports: [MessageService]
})
export class MessageModule { }

