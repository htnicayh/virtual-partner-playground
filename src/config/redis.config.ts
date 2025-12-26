import { RedisModuleOptions } from '@liaoliaots/nestjs-redis'

export const getRedisConfig = (): RedisModuleOptions => ({
	config: {
		host: process.env.REDIS_HOST,
		port: Number(process.env.REDIS_PORT),
		password: process.env.REDIS_PASSWORD
	}
})
