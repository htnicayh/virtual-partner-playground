import { GoogleGenAI, Modality } from '@google/genai'
import mic from 'mic'
import Speaker from 'speaker'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
	console.error('Please set GEMINI_API_KEY environment variable')
	process.exit(1)
}

const ai = new GoogleGenAI({ apiKey })

const model = 'gemini-2.5-flash-native-audio-preview-12-2025'
const config = {
	responseModalities: [Modality.AUDIO],
	systemInstruction: 'You are a helpful and friendly AI assistant.'
}

async function liveServer() {
	const audioQueue = []
	let speaker = null

	const createSpeaker = () => {
		if (speaker) {
			speaker.end()
		}
		speaker = new Speaker({
			channels: 1,
			bitDepth: 16,
			sampleRate: 24000
		})
		speaker.on('error', (err) => console.error('Speaker error:', err))
	}

	const playbackLoop = async () => {
		while (true) {
			if (audioQueue.length === 0) {
				if (speaker) {
					speaker.end()
					speaker = null
				}
				await new Promise((resolve) => setImmediate(resolve))
				continue
			}

			if (!speaker) createSpeaker()

			const chunk = audioQueue.shift()
			await new Promise((resolve) => {
				speaker.write(chunk, resolve)
			})
		}
	}

	playbackLoop()

	const session = await ai.live.connect({
		model,
		config,
		callbacks: {
			onopen: () => console.log('Connected to Gemini Live API'),
			onmessage: (message) => {
				if (message.serverContent?.interrupted) {
					audioQueue.length = 0
					return
				}
				if (message.serverContent?.modelTurn?.parts) {
					for (const part of message.serverContent.modelTurn.parts) {
						if (part.inlineData?.data) {
							const buffer = Buffer.from(part.inlineData.data, 'base64')
							audioQueue.push(buffer)
						}
					}
				}
			},
			onerror: (e) => console.error('Error:', e.message),
			onclose: (e) => console.log('Closed:', e.reason)
		}
	})

	const micInstance = mic({
		rate: '16000',
		channels: '1',
		bitwidth: '16'
	})

	const micInputStream = micInstance.getAudioStream()

	micInputStream.on('data', (data) => {
		session.sendRealtimeInput({
			audio: {
				data: data.toString('base64'),
				mimeType: 'audio/pcm;rate=16000'
			}
		})
	})

	micInputStream.on('error', (err) => console.error('Microphone error:', err))

	micInstance.start()
	console.log('Microphone started. Speak now...')
}

liveServer().catch(console.error)
