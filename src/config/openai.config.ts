export const getOpenAIConfig = () => ({
	apiKey: process.env.OPENAI_API_KEY,
	model: 'gpt-4o',
	temperature: 0.7,
	maxTokens: 1000
})
