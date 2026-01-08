import { RedisModuleOptions } from '@liaoliaots/nestjs-redis'

import 'dotenv/config'

export const getRedisConfig = (): RedisModuleOptions => ({
	config: {
		url: process.env.REDIS_URL
	}
})
