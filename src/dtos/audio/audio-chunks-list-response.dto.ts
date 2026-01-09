import { AudioChunkResponseDto } from './audio-chunk-response.dto'

export class AudioChunksListResponseDto {
	messageId: string
	chunks: AudioChunkResponseDto[]
	total: number
	totalBytes: number
}
