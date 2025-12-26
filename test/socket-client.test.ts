import * as fs from 'fs'
import { io, Socket } from 'socket.io-client'

interface TestConfig {
	serverUrl: string
	namespace: string
	audioFilePath?: string
	chunkSize: number
	timeout: number
}

class AudioStreamTestClient {
	private socket: Socket | null = null
	private config: TestConfig

	constructor(config: Partial<TestConfig> = {}) {
		this.config = {
			serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
			namespace: '/audio',
			chunkSize: 8192,
			timeout: 30000,
			...config
		}
	}

	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.socket = io(`${this.config.serverUrl}${this.config.namespace}`, {
				reconnection: true,
				reconnectionDelay: 1000,
				reconnectionDelayMax: 5000,
				reconnectionAttempts: 5
			})

			this.socket.on('connect', () => {
				console.log('✓ Connected to server')
				resolve()
			})

			this.socket.on('connect_error', (error) => {
				console.error('✗ Connection error:', error)
				reject(error)
			})

			this.socket.on('disconnect', (reason) => {
				console.log(`✓ Disconnected: ${reason}`)
			})

			setTimeout(() => reject(new Error('Connection timeout')), this.config.timeout)
		})
	}

	async disconnect(): Promise<void> {
		if (this.socket) {
			this.socket.disconnect()
			await new Promise((resolve) => setTimeout(resolve, 500))
		}
	}

	async startStream(userId: string, conversationId: string, sessionId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) reject(new Error('Not connected'))

			this.socket!.emit(
				'start-stream',
				{
					userId,
					conversationId,
					sessionId,
					provider: 'gemini'
				},
				(response: any) => {
					console.log('Stream started:', response)
					resolve()
				}
			)

			setTimeout(() => reject(new Error('Start stream timeout')), this.config.timeout)
		})
	}

	async sendAudioChunk(chunk: Buffer, chunkIndex: number, isFinal: boolean): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) reject(new Error('Not connected'))

			const base64Chunk = chunk.toString('base64')

			this.socket!.emit(
				'audio-chunk',
				{
					chunk: base64Chunk,
					chunkIndex,
					isFinal
				},
				(response: any) => {
					if (response?.error) {
						reject(new Error(response.error))
					} else {
						resolve()
					}
				}
			)

			setTimeout(() => reject(new Error('Chunk send timeout')), this.config.timeout)
		})
	}

	async sendAudioFile(filePath: string): Promise<void> {
		if (!fs.existsSync(filePath)) {
			throw new Error(`Audio file not found: ${filePath}`)
		}

		const fileBuffer = fs.readFileSync(filePath)
		const totalChunks = Math.ceil(fileBuffer.length / this.config.chunkSize)

		console.log(`Sending ${fileBuffer.length} bytes in ${totalChunks} chunks...`)

		for (let i = 0; i < totalChunks; i++) {
			const start = i * this.config.chunkSize
			const end = Math.min(start + this.config.chunkSize, fileBuffer.length)
			const chunk = fileBuffer.subarray(start, end)
			const isFinal = i === totalChunks - 1

			await this.sendAudioChunk(chunk as Buffer, i, isFinal)
			console.log(`Sent chunk ${i + 1}/${totalChunks}`)
		}
	}

	async endStream(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) reject(new Error('Not connected'))

			this.socket!.emit('end-stream', { sessionId: 'test-session' }, (response: any) => {
				console.log('Stream ended:', response)
				resolve()
			})

			setTimeout(() => reject(new Error('End stream timeout')), this.config.timeout)
		})
	}

	async cancelStream(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.socket) reject(new Error('Not connected'))

			this.socket!.emit('cancel-stream', { sessionId: 'test-session' }, (response: any) => {
				console.log('Stream cancelled:', response)
				resolve()
			})

			setTimeout(() => reject(new Error('Cancel stream timeout')), this.config.timeout)
		})
	}

	async getSessionInfo(): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.socket) reject(new Error('Not connected'))

			this.socket!.emit('get-session-info', { sessionId: 'test-session' }, (response: any) => {
				console.log('Session info:', response)
				resolve(response)
			})

			setTimeout(() => reject(new Error('Get session info timeout')), this.config.timeout)
		})
	}

	onTranscriptionComplete(callback: (data: any) => void): void {
		if (this.socket) {
			this.socket.on('user-transcript', callback)
		}
	}

	onResponseGenerated(callback: (data: any) => void): void {
		if (this.socket) {
			this.socket.on('ai-response', callback)
		}
	}

	onProcessing(callback: (data: any) => void): void {
		if (this.socket) {
			this.socket.on('processing', callback)
		}
	}

	onResponseComplete(callback: (data: any) => void): void {
		if (this.socket) {
			this.socket.on('response-complete', callback)
		}
	}

	onError(callback: (error: any) => void): void {
		if (this.socket) {
			this.socket.on('error', callback)
		}
	}

	onChunkReceived(callback: (data: any) => void): void {
		if (this.socket) {
			this.socket.on('chunk-received', callback)
		}
	}
}

async function runTests() {
	const client = new AudioStreamTestClient({
		serverUrl: 'http://localhost:3000'
	})

	try {
		console.log('\n========== SOCKET CLIENT TESTS ==========\n')

		console.log('1. Testing connection...')
		await client.connect()

		console.log('\n2. Testing event listeners...')
		client.onTranscriptionComplete((data) => {
			console.log('📝 Transcription:', data.text)
		})
		client.onResponseGenerated((data) => {
			console.log('🤖 AI Response:', data.text)
		})
		client.onProcessing((data) => {
			console.log('⏳ Processing:', data.status)
		})
		client.onResponseComplete((data) => {
			console.log('✅ Response Complete:', {
				userTranscript: data.userTranscript,
				aiResponse: data.aiResponse?.substring(0, 50) + '...',
				processingTime: data.processingTime + 'ms'
			})
		})
		client.onError((error) => {
			console.error('❌ Error:', error)
		})
		client.onChunkReceived((data) => {
			console.log(`📦 Chunk ${data.chunkIndex} received (${data.bytesReceived} bytes)`)
		})

		console.log('\n3. Testing start stream...')
		await client.startStream('test-user-123', 'conv-456', 'session-789')

		console.log('\n4. Testing session info...')
		const sessionInfo = await client.getSessionInfo()
		console.log('Session info retrieved:', !!sessionInfo)

		console.log('\n5. Testing end stream...')
		await client.endStream()

		console.log('\n6. Testing cancel stream...')
		await client.startStream('test-user-123', 'conv-456', 'session-789')
		await client.cancelStream()

		console.log('\n========== ALL TESTS PASSED ==========\n')
	} catch (error) {
		console.error('\n========== TEST FAILED ==========')
		console.error(error)
		process.exit(1)
	} finally {
		await client.disconnect()
	}
}

export { AudioStreamTestClient }

if (require.main === module) {
	runTests()
}
