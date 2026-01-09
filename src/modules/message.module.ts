import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MessageController } from '../controllers/message.controller'
import { Conversation, Message } from '../models'
import { MessageService } from '../services/message.service'
import { UserModule } from './user.module'

@Module({
	imports: [TypeOrmModule.forFeature([Message, Conversation]), UserModule],
	controllers: [MessageController],
	providers: [MessageService],
	exports: [MessageService]
})
export class MessageModule {}
