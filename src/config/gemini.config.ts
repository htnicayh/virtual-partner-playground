export const getGeminiConfig = () => ({
	apiKey: process.env.GOOGLE_GEMINI_API_KEY,
	model: 'gemini-2.5-flash',
	temperature: 0.7,
	maxTokens: 1000
})
