export const GLOBAL_PREFIX = 'api'

export const EVENTS = {
	START_STREAM: 'start-stream',
	AUDIO_CHUNK: 'audio-chunk',
	END_STREAM: 'end-stream',
	CANCEL_STREAM: 'cancel-stream',
	GET_SESSION_INFO: 'get-session-info',
	END_CONVERSATION: 'end-conversation'
}

export const EVENTS_EMIT = {
	CONNECTION: 'connection',
	STREAM_STARTED: 'stream-started',
	ERROR: 'error',
	CHUNK_RECEIVED: 'chunk-received',
	STREAM_CANCELLED: 'stream-cancelled',
	CONVERSATION_ENDED: 'conversation-ended',
	PROCESSING: 'processing',
	USER_TRANSCRIPT: 'user-transcript',
	AI_RESPONSE: 'ai-response',
	RESPONSE_COMPLETE: 'response-complete',
	LIVE_AUDIO_CHUNK: 'live-audio-chunk',
	LIVE_TRANSCRIPT: 'live-transcript',
	LIVE_INTERRUPTED: 'live-interrupted',
	LIVE_SESSION_READY: 'live-session-ready'
}
