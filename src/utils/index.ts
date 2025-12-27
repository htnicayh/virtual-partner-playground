import { FileWriter } from 'wav'
import * as fs from 'fs'

export const handleGeminiPlayback = (
	filename: string,
	pcmData: Buffer,
	channels = 1,
	rate = 24000,
	sampleWidth = 2
) => {
	return new Promise<void>((resolve, reject) => {
		try {
			const writer = new FileWriter(filename, {
				channels,
				sampleRate: rate,
				bitDepth: sampleWidth * 8
			})

			writer.on('finish', resolve)
			writer.on('error', reject)

			writer.write(pcmData)
			writer.end()
		} catch (error) {
			reject(error)
		}
	})
}

export const saveAudioBufferAsWav = (
	filepath: string,
	audioBuffer: Buffer,
	channels = 1,
	sampleRate = 16000,
	sampleWidth = 2
): Promise<void> => {
	return new Promise((resolve, reject) => {
		try {
			const writer = new FileWriter(filepath, {
				channels,
				sampleRate,
				bitDepth: sampleWidth * 8
			})

			writer.on('finish', resolve)
			writer.on('error', reject)

			writer.write(audioBuffer)
			writer.end()
		} catch (error) {
			reject(error)
		}
	})
}
