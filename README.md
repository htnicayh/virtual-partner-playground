# Virtual English Partner - Backend

A WebSocket-based backend server for practicing English with an AI tutor using OpenAI GPT, Whisper STT, and TTS.

## Features

- **Text Chat** - Real-time conversations with AI English tutor
- **Voice Support** - Speech-to-text (Whisper), text-to-speech (TTS)
- **Conversation History** - Track and retrieve chat history
- **WebSocket Real-time** - Socket.io for instant communication
- **Token Tracking** - Monitor API usage and costs
- **Adaptive Learning** - AI adjusts to your English level

## Quick Start

### 1. Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API Key

### 2. Installation

```bash
# Clone repository
git clone <repo-url>
cd virtual-partner-backend

# Install dependencies
bun i
```

### 3. Configuration

```bash
# Copy environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
OPENAI_API_KEY=sk-your_api_key_here
```

### 4. Run Server

```bash
# Development mode with watch
bun run dev

# Or production build and run
bun run build
bun start
```

Server runs on `http://localhost:3000`

## WebSocket API

### Audio Stream Flow

The audio streaming gateway handles real-time voice communication through WebSocket:

#### 1. Start Stream Session

```javascript
socket.emit('start-stream', {
	userId: 'user-id',
	conversationId: 'conversation-uuid',
	provider: 'openai' // or 'gemini'
})

socket.on('stream-started', {
	sessionKey: 'socket-id:conversation-id',
	status: 'streaming',
	timestamp: Date.now()
})
```

#### 2. Send Audio Chunks

```javascript
// Send WebM/Opus encoded audio chunks
socket.emit('audio-chunk', {
	sessionKey: 'socket-id:conversation-id',
	chunk: 'base64-encoded-audio',
	isFinal: false
})

socket.on('chunk-received', {
	bytesReceived: 65536,
	duration: 500,
	timestamp: Date.now()
})
```

#### 3. Process Complete Audio

```javascript
// Mark final chunk or explicitly end stream
socket.emit('audio-chunk', {
	sessionKey: 'socket-id:conversation-id',
	chunk: 'base64-encoded-audio',
	isFinal: true
})

// Or use end-stream event
socket.emit('end-stream', {
	sessionKey: 'socket-id:conversation-id'
})

socket.on('stream-ended', {
	status: 'processing',
	timestamp: Date.now()
})
```

#### 4. Audio Processing Pipeline

The gateway executes the following sequence:

1. **Transcription** (STT)
   - Concatenate all audio chunks
   - Call Whisper API for speech-to-text
   - Emit transcribed text to client

2. **AI Response Generation** (LLM)
   - Retrieve conversation history
   - Send messages to OpenAI/Gemini API
   - Generate AI response

3. **Text-to-Speech** (TTS)
   - Convert AI response to audio
   - Save audio file
   - Return audio URL

4. **Database Storage**
   - Save user message to database
   - Save AI response with audio URL
   - Update conversation history

#### 5. Complete Response

```javascript
socket.on('response-complete', {
	userMessage: 'What user said',
	aiResponse: 'AI response text',
	audioUrl: 'https://..../audio.mp3',
	provider: 'openai',
	timestamp: Date.now()
})
```

#### 6. Cancel Stream

```javascript
socket.emit('cancel-stream', {
	sessionKey: 'socket-id:conversation-id'
})

socket.on('stream-cancelled', {
	status: 'cancelled',
	timestamp: Date.now()
})
```

#### 7. Session Info

```javascript
socket.emit('get-session-info', {
	sessionKey: 'socket-id:conversation-id'
})

socket.on('session-info', {
	sessionKey: 'socket-id:conversation-id',
	userId: 'user-id',
	conversationId: 'conversation-uuid',
	isStreaming: true,
	audioSize: 65536,
	duration: 2500,
	timestamp: Date.now()
})
```

### Text Message Events (Deprecated)

```javascript
socket.emit('text-message', {
	message: 'Hello, how are you?',
	conversationId: 'optional-uuid'
})

socket.on('text-response', {
	response: 'AI response',
	conversationId: 'uuid',
	messageId: 'uuid',
	timestamp: Date,
	metadata: { inputTokens, outputTokens, processingTime }
})
```

### Get History

```javascript
socket.emit('get-conversation-history', {
  conversationId: 'uuid'
})

socket.on('conversation-history', {
  conversationId: 'uuid',
  messages: [ ... ],
  count: 10
})
```

## Architecture

The backend uses a modular architecture with WebSocket-based real-time communication:

```
AudioStreamGateway (WebSocket /audio)
    ↓
├── SessionService (Session management)
├── STTService (Speech-to-Text)
├── LLMService (AI Response Generation)
├── TTSService (Text-to-Speech)
└── ConversationService (Message Storage)
```

## Project Structure

```
src/
├── main.ts
├── config/
│   ├── gemini.config.ts
│   ├── openai.config.ts
│   ├── postgres.config.ts
│   └── redis.config.ts
├── controllers/
│   ├── audio.controller.ts
│   ├── chat.controller.ts
│   ├── conversation.controller.ts
│   └── health.controller.ts
├── dtos/
├── gateways/
│   └── audio-stream.gateway.ts
├── models/
│   ├── conversation.model.ts
│   ├── message.model.ts
│   ├── session.model.ts
│   └── user.model.ts
├── modules/
│   ├── app.module.ts
│   └── health.module.ts
└── services/
    ├── conversation.service.ts
    ├── llm.service.ts
    ├── session.service.ts
    ├── speech-to-text.service.ts
    └── text-to-speech.service.ts
```

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
CORS_ORIGIN=*

# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_TTS_VOICE=nova
```

### Available Models

- `gpt-4o` - Best quality
- `gpt-4o-mini` - **Recommended** (fast & cheap)
- `gpt-4-turbo` - Balanced
- `gpt-3.5-turbo` - Fastest/cheapest

### Available TTS Voices

- `alloy`, `echo`, `fable`, `nova`, `onyx`, `shimmer`

## Costs

Typical per conversation:

- GPT-4o-mini: ~$0.00008
- Whisper STT: ~$0.003 per 15 sec
- TTS: ~$0.0000016 per 100 chars

**Total: ~$0.003 per minute** - Very affordable!

## Testing

### Browser Console

```javascript
const socket = io('http://localhost:3000/chat')

socket.on('connected', () => {
	socket.emit('text-message', { message: 'Hello!' })
})

socket.on('text-response', (data) => {
	console.log(data.response)
})
```

### Node.js Test

```bash
bun i socket.io-client
node test-client.js
```

## Debugging

### Enable Debug Logs

```bash
DEBUG=* bun run dev
```

### Check Logs

- Connection events
- Message processing
- Token usage
- API errors

## Next Steps

- [ ] Add database (PostgreSQL)
- [ ] Authentication (JWT)
- [ ] User profiles
- [ ] Conversation analytics
- [ ] Advanced AI features
- [ ] Rate limiting
- [ ] Error tracking

## System Prompt

The AI is configured as an English conversation partner that:

- Engages naturally and encouragingly
- Corrects grammar gently
- Suggests vocabulary improvements
- Asks follow-up questions
- Adapts to user's level
- Provides explanations

## Troubleshooting

### "OPENAI_API_KEY not set"

Check .env file has the key

### "Invalid API key"

Verify key from https://platform.openai.com/api-keys

### WebSocket connection fails

- Check server is running
- Check CORS settings
- Check port 3000 is available

### "Could not transcribe audio"

- Audio must be WAV format
- Sufficient audio duration
- Clear audio quality

## Resources

- [NestJS Docs](https://docs.nestjs.com)
- [Socket.io Docs](https://socket.io/docs/)
- [OpenAI API](https://platform.openai.com/docs)
