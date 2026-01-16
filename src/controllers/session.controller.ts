import {
	Body,
	Controller,
	DefaultValuePipe,
	Delete,
	Get,
	HttpException,
	HttpStatus,
	Logger,
	Param,
	ParseIntPipe,
	Post,
	Put,
	Query,
	Req,
	UseGuards
} from '@nestjs/common'
import { SessionGuard } from '../commons/guards/session.guard'
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
		@Req() req: any,
		@Body() dto: CreateSessionDto
	): Promise<{ success: boolean; sessionId: string }> {
		const sessionToken = req.headers['x-session-token']
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
	@UseGuards(SessionGuard)
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
	@UseGuards(SessionGuard)
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
	@UseGuards(SessionGuard)
	async getActiveSessions(@Req() req: any): Promise<SessionsListResponseDto> {
		try {
			const user = req.user
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
	@UseGuards(SessionGuard)
	async getUserSessions(
		@Req() req: any,
		@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number
	): Promise<SessionsListResponseDto> {
		try {
			const user = req.user
			const sessions = await this.sessionService.getUserSessions(user.id, limit)

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
	@UseGuards(SessionGuard)
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
