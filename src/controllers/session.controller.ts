import {
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	HttpException,
	HttpStatus,
	Logger,
	Param,
	Post,
	Put,
	Query
} from '@nestjs/common'

import { CreateSessionDto } from '../dtos/session/create-session.dto'
import { SessionsListResponseDto } from '../dtos/session/sessions-list-response.dto'
import { SessionService } from '../services/session.service'
import { UserService } from '../services/user.service'

@Controller()
export class SessionController {
	private readonly logger = new Logger(SessionController.name)

	constructor(
		private readonly userService: UserService,
		private readonly sessionService: SessionService
	) {}

	@Post('/')
	async createSession(
		@Headers('x-session-token') sessionToken: string,
		@Body() dto: CreateSessionDto
	): Promise<{ success: boolean; sessionId: string }> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const session = await this.sessionService.createSession(user.id, dto, sessionToken)

			return { success: true, sessionId: session.id }
		} catch (error) {
			this.logger.error(`Create session error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Put('/:socketId/end')
	async endSession(@Param('socketId') socketId: string): Promise<{ success: boolean; message: string }> {
		try {
			await this.sessionService.endSession(socketId)

			return { success: true, message: 'Session ended successfully' }
		} catch (error) {
			this.logger.error(`End session error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Put('/:socketId/activity')
	async updateSessionActivity(@Param('socketId') socketId: string): Promise<{ success: boolean; message: string }> {
		try {
			await this.sessionService.updateSessionActivity(socketId)

			return { success: true, message: 'Session activity updated' }
		} catch (error) {
			this.logger.error(`Update session activity error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/active')
	async getActiveSessions(@Headers('x-session-token') sessionToken: string): Promise<SessionsListResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const sessions = await this.sessionService.getActiveSessions(user.id)

			return {
				sessions: sessions.map((s) => this.sessionService.mapToResponseDto(s)),
				total: sessions.length
			}
		} catch (error) {
			this.logger.error(`Get active sessions error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/')
	async getUserSessions(
		@Headers('x-session-token') sessionToken: string,
		@Query('limit') limit?: string
	): Promise<SessionsListResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)
			const limitNum = limit ? parseInt(limit, 10) : 50
			const sessions = await this.sessionService.getUserSessions(user.id, limitNum)

			return {
				sessions: sessions.map((s) => this.sessionService.mapToResponseDto(s)),
				total: sessions.length
			}
		} catch (error) {
			this.logger.error(`Get user sessions error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Delete('/cleanup')
	async cleanupInactiveSessions(@Query('days') days?: string): Promise<{ success: boolean; deleted: number }> {
		try {
			const daysOld = days ? parseInt(days, 10) : 7
			const deleted = await this.sessionService.cleanupInactiveSessions(daysOld)

			return { success: true, deleted }
		} catch (error) {
			this.logger.error(`Cleanup sessions error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}
}
