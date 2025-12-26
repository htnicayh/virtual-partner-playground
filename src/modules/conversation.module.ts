import { Module } from '@nestjs/common'
import { ConversationController } from '../controllers/conversation.controller'
import { ConversationService } from '../services/conversation.service'

@Module({
	controllers: [ConversationController],
	providers: [ConversationService],
	exports: [ConversationService]
})
export class ConversationModule {}
