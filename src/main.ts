import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)
	const logger = new Logger('Resolver')

	app.enableCors({
		origin: process.env.CORS_ORIGIN || '*',
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE']
	})

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true
		})
	)

	const port = process.env.PORT || 3000

	await app.listen(port)

	logger.log(`- 🎓 Virtual English Partner Backend `)
	logger.log(`- ✅ Server running on port ${port}`)
	logger.log(`- 🌐 WebSocket: ws://localhost:${port}`)
}

bootstrap().catch(() => process.exit(1))
