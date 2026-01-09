export class SessionResponseDto {
	id: string
	socketId: string
	isActive: boolean
	connectedAt: Date
	disconnectedAt: Date | null
	lastActivityAt: Date
}
