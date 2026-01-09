import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SessionController } from '../controllers/session.controller'
import { Session, User } from '../models'
import { SessionService } from '../services/session.service'
import { UserModule } from './user.module'

@Module({
	imports: [TypeOrmModule.forFeature([Session, User]), UserModule],
	controllers: [SessionController],
	providers: [SessionService],
	exports: [SessionService]
})
export class SessionModule {}
