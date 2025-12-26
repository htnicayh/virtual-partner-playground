import { io, Socket } from 'socket.io-client'

const SERVER_URL = 'http://localhost:3000'
const AUDIO_NAMESPACE = '/audio'

interface TestConfig {
	userId: string
	conversationId: string
	provider: 'openai' | 'gemini'
	audioFilePath?: string
}

class AudioStreamClient {
	private socket: Socket | null = null
	private config: TestConfig

	constructor(config: TestConfig) {
		this.config = config
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.socket = io(`${SERVER_URL}${AUDIO_NAMESPACE}`, {
				reconnection: true,
				reconnectionDelay: 1000,
				reconnectionDelayMax: 5000,
				reconnectionAttempts: 5
			})

			this.socket.on('connect', () => {
				console.log('✓ Connected to server:', this.socket?.id)
				resolve()
			})

			this.socket.on('connect_error', (error) => {
				console.error('✗ Connection error:', error)
				reject(error)
			})

			this.socket.on('error', (error) => {
				console.error('✗ Socket error:', error)
			})

			this.socket.on('disconnected', () => {
				console.log('✓ Disconnected from server')
			})
		})
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect()
		}
	}

	startStream(): Promise<string> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Socket not connected'))
				return
			}

			this.socket.once('stream-started', (data) => {
				console.log('✓ Stream started:', data)
				resolve(data.sessionKey)
			})

			this.socket.once('error', (error) => {
				console.error('✗ Start stream error:', error)
				reject(error)
			})

			console.log('Emitting start-stream event...')
			this.socket.emit('start-stream', {
				userId: this.config.userId,
				conversationId: this.config.conversationId,
				provider: this.config.provider
			})
		})
	}

	sendAudioChunk(sessionKey: string, chunk: Buffer, isFinal: boolean = false): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Socket not connected'))
				return
			}

			this.socket.once('chunk-received', (data) => {
				console.log(`✓ Chunk received - bytes: ${data.bytesReceived}, duration: ${data.duration}ms`)
				resolve()
			})

			this.socket.once('error', (error) => {
				console.error('✗ Audio chunk error:', error)
				reject(error)
			})

			const chunkBase64 = chunk.toString('base64')
			console.log(`Sending audio chunk (${chunk.length} bytes, isFinal: ${isFinal})...`)

			this.socket.emit('audio-chunk', {
				sessionKey,
				chunk: chunkBase64,
				isFinal
			})
		})
	}

	endStream(sessionKey: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Socket not connected'))
				return
			}

			this.socket.once('stream-ended', (data) => {
				console.log('✓ Stream ended:', data)
				resolve()
			})

			this.socket.once('error', (error) => {
				console.error('✗ End stream error:', error)
				reject(error)
			})

			console.log('Ending stream...')
			this.socket.emit('end-stream', { sessionKey })
		})
	}

	cancelStream(sessionKey: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Socket not connected'))
				return
			}

			this.socket.once('stream-cancelled', (data) => {
				console.log('✓ Stream cancelled:', data)
				resolve()
			})

			this.socket.once('error', (error) => {
				console.error('✗ Cancel stream error:', error)
				reject(error)
			})

			console.log('Cancelling stream...')
			this.socket.emit('cancel-stream', { sessionKey })
		})
	}

	onTranscriptionComplete(callback: (data: any) => void): void {
		if (!this.socket) {
			throw new Error('Socket not connected')
		}
		this.socket.on('transcription-complete', callback)
	}

	onResponseGenerated(callback: (data: any) => void): void {
		if (!this.socket) {
			throw new Error('Socket not connected')
		}
		this.socket.on('response-generated', callback)
	}

	onProcessing(callback: (data: any) => void): void {
		if (!this.socket) {
			throw new Error('Socket not connected')
		}
		this.socket.on('processing', callback)
	}

	onResponseComplete(callback: (data: any) => void): void {
		if (!this.socket) {
			throw new Error('Socket not connected')
		}
		this.socket.on('response-complete', callback)
	}

	getSessionInfo(sessionKey: string): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				reject(new Error('Socket not connected'))
				return
			}

			this.socket.once('session-info', (data) => {
				console.log('✓ Session info:', data)
				resolve(data)
			})

			this.socket.once('error', (error) => {
				console.error('✗ Session info error:', error)
				reject(error)
			})

			this.socket.emit('get-session-info', { sessionKey })
		})
	}
}

// Test scenarios
async function testBasicConnection() {
	console.log('\n========== TEST: Basic Connection ==========')
	const client = new AudioStreamClient({
		userId: 'test-user-1',
		conversationId: 'test-conv-1',
		provider: 'openai'
	})

	try {
		await client.connect()
		console.log('✓ Connection test passed')
		client.disconnect()
	} catch (error) {
		console.error('✗ Connection test failed:', error)
		client.disconnect()
		throw error
	}
}

async function testStartStream() {
	console.log('\n========== TEST: Start Stream ==========')
	const client = new AudioStreamClient({
		userId: 'test-user-2',
		conversationId: 'test-conv-2',
		provider: 'openai'
	})

	try {
		await client.connect()
		const sessionKey = await client.startStream()
		console.log('✓ Start stream test passed')
		await client.endStream(sessionKey)
		client.disconnect()
	} catch (error) {
		console.error('✗ Start stream test failed:', error)
		client.disconnect()
		throw error
	}
}

async function testAudioChunks() {
	console.log('\n========== TEST: Audio Chunks ==========')
	const client = new AudioStreamClient({
		userId: 'test-user-3',
		conversationId: 'test-conv-3',
		provider: 'openai'
	})

	try {
		await client.connect()
		const sessionKey = await client.startStream()

		// Simulate sending audio chunks
		const mockAudio1 = Buffer.from('This is mock audio chunk 1')
		const mockAudio2 = Buffer.from('This is mock audio chunk 2')

		await client.sendAudioChunk(sessionKey, mockAudio1, false)
		await client.sendAudioChunk(sessionKey, mockAudio2, true) // Final chunk

		console.log('✓ Audio chunks test passed')
		client.disconnect()
	} catch (error) {
		console.error('✗ Audio chunks test failed:', error)
		client.disconnect()
		throw error
	}
}

async function testSessionInfo() {
	console.log('\n========== TEST: Session Info ==========')
	const client = new AudioStreamClient({
		userId: 'test-user-4',
		conversationId: 'test-conv-4',
		provider: 'gemini'
	})

	try {
		await client.connect()
		const sessionKey = await client.startStream()

		// Wait a bit
		await new Promise((resolve) => setTimeout(resolve, 500))

		const sessionInfo = await client.getSessionInfo(sessionKey)
		console.log('Session info retrieved:', sessionInfo)

		await client.endStream(sessionKey)
		console.log('✓ Session info test passed')
		client.disconnect()
	} catch (error) {
		console.error('✗ Session info test failed:', error)
		client.disconnect()
		throw error
	}
}

async function testFullAudioFlow() {
	console.log('\n========== TEST: Full Audio Flow ==========')
	const client = new AudioStreamClient({
		userId: 'test-user-5',
		conversationId: 'test-conv-5',
		provider: 'openai'
	})

	try {
		await client.connect()

		// Listen for events
		client.onProcessing((data) => {
			console.log('📊 Processing:', data)
		})

		client.onTranscriptionComplete((data) => {
			console.log('✓ Transcription complete:', data.userMessage)
		})

		client.onResponseGenerated((data) => {
			console.log('✓ Response generated:', data.aiResponse)
		})

		client.onResponseComplete((data) => {
			console.log('✓ Response complete:')
			console.log('  User: ', data.userMessage)
			console.log('  AI:   ', data.aiResponse)
			console.log('  Audio:', data.audioUrl)
		})

		const sessionKey = await client.startStream()

		// Simulate audio streaming
		const mockAudio = Buffer.from('Hello, how are you today?')
		await client.sendAudioChunk(sessionKey, mockAudio, true)

		// Wait for processing
		await new Promise((resolve) => setTimeout(resolve, 3000))

		console.log('✓ Full audio flow test passed')
		client.disconnect()
	} catch (error) {
		console.error('✗ Full audio flow test failed:', error)
		client.disconnect()
		throw error
	}
}

async function testCancelStream() {
	console.log('\n========== TEST: Cancel Stream ==========')
	const client = new AudioStreamClient({
		userId: 'test-user-6',
		conversationId: 'test-conv-6',
		provider: 'openai'
	})

	try {
		await client.connect()
		const sessionKey = await client.startStream()

		const mockAudio = Buffer.from('Some audio')
		await client.sendAudioChunk(sessionKey, mockAudio, false)

		// Cancel before completion
		await client.cancelStream(sessionKey)

		console.log('✓ Cancel stream test passed')
		client.disconnect()
	} catch (error) {
		console.error('✗ Cancel stream test failed:', error)
		client.disconnect()
		throw error
	}
}

// Run all tests
async function runAllTests() {
	console.log('='.repeat(50))
	console.log('Audio Stream Gateway - Client Tests')
	console.log('='.repeat(50))

	try {
		await testBasicConnection()
		await testStartStream()
		await testAudioChunks()
		await testSessionInfo()
		await testCancelStream()
		await testFullAudioFlow()

		console.log('\n' + '='.repeat(50))
		console.log('✓ All tests passed!')
		console.log('='.repeat(50))
	} catch (error) {
		console.error('\n' + '='.repeat(50))
		console.error('✗ Some tests failed')
		console.error('='.repeat(50))
		process.exit(1)
	}
}

// Run tests if this is the main module
if (require.main === module) {
	runAllTests().catch((error) => {
		console.error('Fatal error:', error)
		process.exit(1)
	})
}

export { AudioStreamClient, TestConfig }
