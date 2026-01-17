import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { RouterModule } from '@nestjs/core'
import { AudioStreamGateway } from '../gateways/audio-stream.gateway'
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'
import { AudioChunkModule } from './audio-chunk.module'
import { ConversationModule } from './conversation.module'
import { DatabaseModule } from './database.module'
import { HealthModule } from './health.module'
import { MessageModule } from './message.module'
import { SessionModule } from './session.module'
import { UserModule } from './user.module'

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		RouterModule.register([
			{
				path: '/api',
				module: AppModule,
				children: [
					{
						path: '/users',
						module: UserModule
					},
					{
						path: '/conversations',
						module: ConversationModule
					},
					{
						path: '/messages',
						module: MessageModule
					},
					{
						path: '/audio-chunks',
						module: AudioChunkModule
					},
					{
						path: '/sessions',
						module: SessionModule
					}
				]
			},
			{
				path: '/health',
				module: HealthModule
			}
		]),
		UserModule,
		HealthModule,
		MessageModule,
		SessionModule,
		DatabaseModule,
		AudioChunkModule,
		ConversationModule
	],
	providers: [AudioStreamGateway, LlmService, CacheService, AudioService]
})
export class AppModule {}
