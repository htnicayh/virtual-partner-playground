import { RedisModule } from '@liaoliaots/nestjs-redis'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { getDatabaseConfig, getDatabaseModels } from '../config/postgres.config'
import { getRedisConfig } from '../config/redis.config'

@Module({
	imports: [
		RedisModule.forRoot(getRedisConfig()),
		TypeOrmModule.forRoot(getDatabaseConfig()),
		TypeOrmModule.forFeature(getDatabaseModels())
	]
})
export class DatabaseModule {}
