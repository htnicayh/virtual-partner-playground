export class AudioChunkResponseDto {
	id: string
	chunkIndex: number
	mimeType: string
	byteSize: number | null
	createdAt: Date
}
