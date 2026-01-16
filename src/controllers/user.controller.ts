import { Body, Controller, Get, Headers, HttpException, HttpStatus, Logger, Post } from '@nestjs/common'
import { InitUserDto } from '../dtos/user/init-user.dto'
import { UserResponseDto } from '../dtos/user/user-response.dto'
import { UserService } from '../services/user.service'

@Controller()
export class UserController {
	private readonly logger = new Logger(UserController.name)

	constructor(private readonly userService: UserService) {}

	@Post('/init')
	async initUser(@Body() dto: InitUserDto): Promise<UserResponseDto> {
		try {
			const user = await this.userService.findOrCreateUser(dto)

			return this.userService.mapToResponseDto(user)
		} catch (error) {
			this.logger.error(`Init user error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}

	@Get('/me')
	async getCurrentUser(@Headers('x-session-token') sessionToken: string): Promise<UserResponseDto> {
		if (!sessionToken) {
			throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
		}

		try {
			const user = await this.userService.getUserBySessionToken(sessionToken)

			return this.userService.mapToResponseDto(user)
		} catch (error) {
			this.logger.error(`Get user error: ${error.message}`)

			if (error instanceof HttpException) {
				throw error
			}

			throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
		}
	}
}
