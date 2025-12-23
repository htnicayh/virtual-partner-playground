# 🎓 Virtual English Partner - Backend

A WebSocket-based backend server for practicing English with an AI tutor using OpenAI GPT, Whisper STT, and TTS.

## ✨ Features

- 💬 **Text Chat** - Real-time conversations with AI English tutor
- 🎤 **Voice Support** - Speech-to-text (Whisper), text-to-speech (TTS)
- 📚 **Conversation History** - Track and retrieve chat history
- 🔄 **WebSocket Real-time** - Socket.io for instant communication
- 📊 **Token Tracking** - Monitor API usage and costs
- 🎯 **Adaptive Learning** - AI adjusts to your English level

## 🚀 Quick Start

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

## 📡 WebSocket API

### Events

#### Text Message

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

#### Voice Message

```javascript
socket.emit('voice-message', {
  audioBase64: 'base64_audio_data',
  conversationId: 'optional-uuid'
})

socket.on('voice-response', {
  userTranscription: 'What user said',
  aiMessage: 'AI response',
  audioBase64: 'base64_audio',
  conversationId: 'uuid',
  messageId: 'uuid',
  metadata: { ... }
})
```

#### Get History

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

## 🏗️ Architecture

```
ChatGateway (WebSocket)
    ↓
ChatService (Business Logic)
    ├── OpenaiService (GPT, STT, TTS)
    └── ConversationService (Message Storage)
```

## 📁 Project Structure

```
src/
├── main.ts
├── app.module.ts
├── chat/
│   ├── chat.gateway.ts
│   ├── chat.service.ts
│   ├── chat.module.ts
│   └── dtos/
│       └── chat.dtos.ts
├── conversation/
│   ├── conversation.service.ts
│   ├── conversation.module.ts
│   └── entities/
│       ├── conversation.entity.ts
│       └── message.entity.ts
└── openai/
    ├── openai.service.ts
    └── openai.module.ts
```

## 🔧 Configuration

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

## 💰 Costs

Typical per conversation:

- GPT-4o-mini: ~$0.00008
- Whisper STT: ~$0.003 per 15 sec
- TTS: ~$0.0000016 per 100 chars

**Total: ~$0.003 per minute** ✅ Very affordable!

## 🧪 Testing

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

## 🔍 Debugging

### Enable Debug Logs

```bash
DEBUG=* bun run dev
```

### Check Logs

- Connection events
- Message processing
- Token usage
- API errors

## 📚 Next Steps

- [ ] Add database (PostgreSQL)
- [ ] Authentication (JWT)
- [ ] User profiles
- [ ] Conversation analytics
- [ ] Advanced AI features
- [ ] Rate limiting
- [ ] Error tracking

## 📝 System Prompt

The AI is configured as an English conversation partner that:

- Engages naturally and encouragingly
- Corrects grammar gently
- Suggests vocabulary improvements
- Asks follow-up questions
- Adapts to user's level
- Provides explanations

## 🐛 Troubleshooting

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

## 📖 Resources

- [NestJS Docs](https://docs.nestjs.com)
- [Socket.io Docs](https://socket.io/docs/)
- [OpenAI API](https://platform.openai.com/docs)
