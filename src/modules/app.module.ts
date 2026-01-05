import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RouterModule } from '@nestjs/core'
import { REDIS_CONNECTION } from '../commons/constants'
import { AudioStreamGateway } from '../gateways/audio-stream.gateway'
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'
import { S3Service } from '../services/s3.service'
import { SessionService } from '../services/session.service'
import { STTService } from '../services/speech-to-text.service'
import { TTSService } from '../services/text-to-speech.service'
import { AudioModule } from './audio.module'
import { ChatModule } from './chat.module'
import { ConversationModule } from './conversation.module'
import { HealthModule } from './health.module'
import { LogModule } from './log.module'

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		RouterModule.register([
			{
				path: '/api',
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
			},
			{
				path: '/logs',
				module: LogModule
			}
		]),
		RedisModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const url = configService.get<string>('REDIS_URL') ?? process.env.REDIS_URL ?? REDIS_CONNECTION

				if (!url) {
					throw new Error('REDIS_URL is not set')
				}

				return { config: { url } } as RedisModuleOptions
			}
		}),
		LogModule,
		ChatModule,
		AudioModule,
		HealthModule,
		ConversationModule
	],
	providers: [
		AudioStreamGateway,
		STTService,
		TTSService,
		S3Service,
		LlmService,
		SessionService,
		CacheService,
		AudioService
	]
})
export class AppModule {}
