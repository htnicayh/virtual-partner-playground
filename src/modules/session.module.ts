import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SessionGuard } from '../commons/guards/session.guard'
import { SessionController } from '../controllers/session.controller'
import { Session, User } from '../models'
import { SessionService } from '../services/session.service'
import { UserModule } from './user.module'

@Module({
	imports: [TypeOrmModule.forFeature([Session, User]), UserModule],
	controllers: [SessionController],
	providers: [SessionService, SessionGuard],
	exports: [SessionService]
})
export class SessionModule { }

