import { Module } from '@nestjs/common'
import { ConversationModule } from '../conversation/conversation.module'
import { OpenaiModule } from '../openai/openai.module'
import { ChatGateway } from './chat.gateway'
import { ChatService } from './chat.service'

@Module({
	imports: [OpenaiModule, ConversationModule],
	providers: [ChatGateway, ChatService],
	exports: [ChatService]
})
export class ChatModule {}
