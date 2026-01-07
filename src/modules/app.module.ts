import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RouterModule } from '@nestjs/core'
import { AudioStreamGateway } from '../gateways/audio-stream.gateway'
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'
import { SessionService } from '../services/session.service'
import { AudioModule } from './audio.module'
import { ChatModule } from './chat.module'
import { ConversationModule } from './conversation.module'
import { HealthModule } from './health.module'

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
			}
		]),
		RedisModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) =>
				({ config: { url: configService.get<string>('REDIS_URL') ?? process.env.REDIS_URL } }) as RedisModuleOptions
		}),
		ChatModule,
		AudioModule,
		HealthModule,
		ConversationModule
	],
	providers: [AudioStreamGateway, LlmService, SessionService, CacheService, AudioService]
})
export class AppModule {}
