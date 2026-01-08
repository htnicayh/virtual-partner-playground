import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { RouterModule } from '@nestjs/core'
import { AudioStreamGateway } from '../gateways/audio-stream.gateway'
import { AudioService } from '../services/audio.service'
import { CacheService } from '../services/cache.service'
import { LlmService } from '../services/llm.service'
import { SessionService } from '../services/session.service'
import { ChatModule } from './chat.module'
import { DatabaseModule } from './database.module'
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
						path: '/chat',
						module: ChatModule
					}
				]
			},
			{
				path: '/health',
				module: HealthModule
			}
		]),
		ChatModule,
		HealthModule,
		DatabaseModule
	],
	providers: [AudioStreamGateway, LlmService, SessionService, CacheService, AudioService]
})
export class AppModule {}
