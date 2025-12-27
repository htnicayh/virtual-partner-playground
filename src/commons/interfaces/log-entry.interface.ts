export interface LogEntry {
	timestamp: string
	level: string
	message: string
	context?: string
}
