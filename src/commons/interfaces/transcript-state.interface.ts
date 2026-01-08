export interface TranscriptState {
	accumulatedText: string // Accumulated text being built up
	lastUpdateTime: number
	timeout: NodeJS.Timeout | null
	lastEmittedText: string // Track what we already emitted
}
