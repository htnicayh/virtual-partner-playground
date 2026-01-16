import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable
} from '@nestjs/common'
import { UserService } from '../../services/user.service'

@Injectable()
export class SessionGuard implements CanActivate {
    constructor(private readonly userService: UserService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const sessionToken = request.headers['x-session-token']

        if (!sessionToken) {
            throw new HttpException('Session token required', HttpStatus.UNAUTHORIZED)
        }

        try {
            const user = await this.userService.getUserBySessionToken(sessionToken)
            request.user = user
            return true
        } catch (error) {
            throw new HttpException('Invalid session token', HttpStatus.UNAUTHORIZED)
        }
    }
}
