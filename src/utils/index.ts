import { FileWriter } from 'wav'

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

export const cleanTranscript = (text: string): string => {
	// Remove all HTML-like tags (anything between < and >)
	let cleaned = text.replace(/<[^>]*>/g, '')

	// Trim whitespace
	cleaned = cleaned.trim()

	// Remove special characters at the beginning of the sentence
	// Keep only letters, numbers, and common punctuation at the start
	cleaned = cleaned.replace(/^[^\w\s¿¡]+/u, '')

	// Trim again after removing special chars
	cleaned = cleaned.trim()

	// Remove multiple spaces
	cleaned = cleaned.replace(/\s+/g, ' ')

	return cleaned
}


export const cleanFinalTranscript = (text: string): string => {
	let cleaned = text
		.trim()
		.replace(/\s+/g, ' ') // Remove multiple spaces
		.replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
		.replace(/([.,!?;:])\s*([.,!?;:])/g, '$1$2') // Remove space between punctuation

	return cleaned
}