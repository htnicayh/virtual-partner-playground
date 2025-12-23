import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ChatModule } from './chat/chat.module'
import { ConversationModule } from './conversation/conversation.module'
import { OpenaiModule } from './openai/openai.module'

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env'
		}),
		OpenaiModule,
		ConversationModule,
		ChatModule
	]
})
export class AppModule {}
