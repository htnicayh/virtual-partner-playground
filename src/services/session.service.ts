import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'
import { CreateSessionDto } from '../dtos/session/create-session.dto'
import { SessionResponseDto } from '../dtos/session/session-response.dto'
import { Session, User } from '../models'

@Injectable()
export class SessionService {
	private readonly logger = new Logger(SessionService.name)

	constructor(
		@InjectRepository(Session)
		private readonly sessionRepository: Repository<Session>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>
	) {}

	async createSession(userId: string, dto: CreateSessionDto, sessionToken: string): Promise<Session> {
		const user = await this.userRepository.findOne({ where: { id: userId } })

		if (!user) {
			throw new NotFoundException('User not found')
		}

		const existing = await this.sessionRepository.findOne({
			where: { socketId: dto.socketId }
		})

		if (existing) {
			throw new BadRequestException('Session with this socket ID already exists')
		}

		const session = this.sessionRepository.create({
			userId,
			socketId: dto.socketId,
			sessionToken,
			ipAddress: dto.ipAddress,
			userAgent: dto.userAgent,
			isActive: true,
			connectedAt: new Date(),
			lastActivityAt: new Date()
		})

		const saved = await this.sessionRepository.save(session)

		this.logger.log(`Created session: ${saved.id} for user: ${userId}`)

		return saved
	}

	async endSession(socketId: string): Promise<void> {
		const session = await this.sessionRepository.findOne({ where: { socketId } })

		if (!session) {
			throw new NotFoundException('Session not found')
		}

		session.isActive = false
		session.disconnectedAt = new Date()

		await this.sessionRepository.save(session)

		this.logger.log(`Ended session: ${session.id}`)
	}

	async updateSessionActivity(socketId: string): Promise<void> {
		const result = await this.sessionRepository.update({ socketId }, { lastActivityAt: new Date() })

		if (!result.affected) {
			throw new NotFoundException('Session not found')
		}
	}

	async getSessionBySocketId(socketId: string): Promise<Session> {
		const session = await this.sessionRepository.findOne({ where: { socketId } })

		if (!session) {
			throw new NotFoundException('Session not found')
		}

		return session
	}

	async getActiveSessions(userId: string): Promise<Session[]> {
		return this.sessionRepository.find({
			where: { userId, isActive: true },
			order: { lastActivityAt: 'DESC' }
		})
	}

	async getUserSessions(userId: string, limit = 50): Promise<Session[]> {
		return this.sessionRepository.find({
			where: { userId },
			order: { connectedAt: 'DESC' },
			take: limit
		})
	}

	async cleanupInactiveSessions(daysOld = 7): Promise<number> {
		if (!Number.isInteger(daysOld) || daysOld <= 0) {
			throw new BadRequestException('daysOld must be a positive integer')
		}

		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - daysOld)

		const result = await this.sessionRepository.delete({
			isActive: false,
			disconnectedAt: LessThan(cutoffDate)
		})

		const deleted = result.affected || 0

		this.logger.log(`Cleaned up ${deleted} inactive sessions`)

		return deleted
	}

	mapToResponseDto(session: Session): SessionResponseDto {
		return {
			id: session.id,
			socketId: session.socketId,
			isActive: session.isActive,
			connectedAt: session.connectedAt,
			disconnectedAt: session.disconnectedAt,
			lastActivityAt: session.lastActivityAt
		}
	}
}
