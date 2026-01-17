import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as crypto from 'crypto'
import { Repository } from 'typeorm'
import { InitUserDto } from '../dtos/user/init-user.dto'
import { UserResponseDto } from '../dtos/user/user-response.dto'
import { User } from '../models/user.model'

@Injectable()
export class UserService {
	private readonly logger = new Logger(UserService.name)

	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>
	) {}

	generateAnonymousId(fingerprint: any): string {
		const data = JSON.stringify(fingerprint)

		return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32)
	}

	generateSessionToken(): string {
		return crypto.randomBytes(32).toString('hex')
	}

	async findOrCreateUser(dto: InitUserDto): Promise<User> {
		let user: User | null = null
		let anonymousId: string | undefined

		if (dto.sessionToken) {
			user = await this.userRepository.findOne({
				where: { sessionToken: dto.sessionToken }
			})
		}

		if (!user && dto.fingerprint) {
			anonymousId = this.generateAnonymousId(dto.fingerprint)

			user = await this.userRepository.findOne({ where: { anonymousId } })
		}

		if (!user) {
			const sessionToken = this.generateSessionToken()

			anonymousId = dto.fingerprint ? this.generateAnonymousId(dto.fingerprint) : undefined
			user = this.userRepository.create({
				anonymousId,
				sessionToken,
				isAnonymous: true,
				firstSeenAt: new Date(),
				lastSeenAt: new Date()
			})

			user = await this.userRepository.save(user)

			this.logger.log(`Created new anonymous user: ${user.id}`)
		} else {
			user.lastSeenAt = new Date()

			await this.userRepository.save(user)
		}

		return user
	}

	async getUserBySessionToken(sessionToken: string): Promise<User> {
		const user = await this.userRepository.findOne({
			where: { sessionToken }
		})

		if (!user) {
			throw new NotFoundException('User not found')
		}

		return user
	}

	async getUserById(userId: string): Promise<User> {
		const user = await this.userRepository.findOne({
			where: { id: userId }
		})

		if (!user) {
			throw new NotFoundException('User not found')
		}

		return user
	}

	mapToResponseDto(user: User): UserResponseDto {
		return {
			userId: user.id,
			sessionToken: user.sessionToken,
			isAnonymous: user.isAnonymous,
			totalConversations: user.totalConversations,
			totalMessages: user.totalMessages,
			firstSeenAt: user.firstSeenAt,
			lastSeenAt: user.lastSeenAt
		}
	}
}
