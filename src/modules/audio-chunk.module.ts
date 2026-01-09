import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AudioChunkController } from '../controllers/audio-chunk.controller'
import { AudioChunk, Conversation, Message } from '../models'
import { AudioChunkService } from '../services/audio-chunk.service'

@Module({
	imports: [TypeOrmModule.forFeature([AudioChunk, Message, Conversation])],
	controllers: [AudioChunkController],
	providers: [AudioChunkService],
	exports: [AudioChunkService]
})
export class AudioChunkModule {}
