import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SessionGuard } from '../commons/guards/session.guard'
import { ConversationController } from '../controllers/conversation.controller'
import { Conversation, User } from '../models'
import { ConversationService } from '../services/conversation.service'
import { UserModule } from './user.module'

@Module({
	imports: [TypeOrmModule.forFeature([Conversation, User]), UserModule],
	controllers: [ConversationController],
	providers: [ConversationService, SessionGuard],
	exports: [ConversationService]
})
export class ConversationModule { }

