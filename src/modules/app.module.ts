import { RedisModule } from '@liaoliaots/nestjs-redis'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { RouterModule } from '@nestjs/core'
import { getRedisConfig } from '../config/redis.config'
import { AudioStreamGateway } from '../gateways/audio-stream.gateway'
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'
import { SessionService } from '../services/session.service'
import { STTService } from '../services/speech-to-text.service'
import { TTSService } from '../services/text-to-speech.service'
import { AudioModule } from './audio.module'
import { ChatModule } from './chat.module'
import { ConversationModule } from './conversation.module'
import { HealthModule } from './health.module'

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env'
		}),
		RouterModule.register([
			{
				path: '/',
				module: AppModule,
				children: [
					{
						path: '/audio',
						module: AudioModule
					},
					{
						path: '/chat',
						module: ChatModule
					},
					{
						path: '/conversations',
						module: ConversationModule
					}
				]
			},
			{
				path: '/health',
				module: HealthModule
			}
		]),
		RedisModule.forRoot(getRedisConfig()),
		ChatModule,
		AudioModule,
		HealthModule,
		ConversationModule
	],
	providers: [AudioStreamGateway, STTService, TTSService, LlmService, SessionService, CacheService, AudioService]
})
export class AppModule {}
