# Virtual English Partner - Backend

A real-time WebSocket-based backend server for practicing English with an AI tutor using Google Gemini Live API.

## Features

- **Real-time Voice Chat** - Low-latency, natural conversations with AI English tutor
- **Multimodal Interaction** - Seamlessly switch between text and voice
- **Live Transcription** - Real-time speech-to-text for both user and AI
- **Interruption Support** - Natural conversation flow where you can interrupt the AI
- **Adaptive Learning** - AI adjusts to your English level and provides gentle corrections
- **Conversation History** - Track and retrieve chat history (PostgreSQL)

### 1. Prerequisites

- Node.js 18+
- Bun (recommended) or npm
- Google Gemini API Key

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

# Edit .env and add your Gemini API key
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

### 4. Run Server

```bash
# Development mode
bun run dev

# Production build and run
bun run build
bun start
```

Server runs on `http://localhost:3000`

## WebSocket API

The backend uses Socket.io for real-time communication. The main namespace is `/audio`.

### Interaction Flow

The following diagram illustrates the real-time interaction flow between the Client, Backend, and Google Gemini Live API:

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Backend
    participant G as Gemini Live API

    C->>B: "emit('start-stream', { sessionId, conversationId })"
    B->>G: "Create Live Session"
    G-->>B: "Session Ready"
    B-->>C: "emit('live-session-ready')"
    B-->>C: "emit('stream-started')"

    loop Audio Streaming
        C->>B: "emit('audio-chunk', { chunk, chunkIndex })"
        B->>G: "Send Real-time Audio"
        G-->>B: "serverContent (Transcription/Audio)"
        B-->>C: "emit('user-transcript')"
        B-->>C: "emit('ai-response') (Text Stream)"
        B-->>C: "emit('live-audio-chunk') (Audio Stream)"
    end

    opt Interruption
        C->>B: "(User starts speaking)"
        G-->>B: "serverContent (interrupted)"
        B-->>C: "emit('live-interrupted')"
    end

    G-->>B: "generationComplete"
    B-->>C: "emit('ai-audio-complete')"
    B-->>C: "emit('response-complete')"

    C->>B: "emit('end-conversation')"
    B->>G: "Close Session"
    B-->>C: "emit('conversation-ended')"
```

### Key Events

- **`user-transcript`**: Real-time transcription of user speech.
- **`ai-response`**: Streaming text response from the AI.
- **`live-audio-chunk`**: Streaming audio chunks from the AI.
- **`live-interrupted`**: Triggered when the user interrupts the AI.
- **`ai-audio-complete`**: AI has finished generating audio.
- **`response-complete`**: Full response cycle finished.



The backend uses a modular architecture with WebSocket-based real-time communication:

```mermaid
graph TD
    A["AudioStreamGateway"] --> B["AudioService"]
    A --> C["CacheService"]
    A --> D["LlmService"]
    D --> E["Google Gemini API"]
    B --> F["Redis/Cache"]
    C --> F
```

## Project Structure

```
src/
├── main.ts
├── commons/
│   ├── constants/
│   └── interfaces/
├── config/
│   └── postgres.config.ts
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
│   ├── audio.module.ts
│   ├── chat.module.ts
│   ├── conversation.module.ts
│   └── health.module.ts
└── services/
    ├── audio.service.ts
    ├── cache.service.ts
    ├── conversation.service.ts
    ├── llm.service.ts
    └── session.service.ts
```

## Configuration

### Environment Variables

```env
# Server
PORT=3000
CORS_ORIGIN=*
FRONTEND_URL=http://localhost:5173

# Database & Cache
DATABASE_URL=postgresql://user:password@localhost:5432/db
REDIS_URL=redis://localhost:6379

# Google Gemini
GOOGLE_GEMINI_API_KEY=your_api_key
GOOGLE_GEMINI_MODEL=gemini-2.0-flash-exp
```

## Troubleshooting

### "GOOGLE_GEMINI_API_KEY not set"

Check `.env` file has the key.

### WebSocket connection fails

- Check server is running
- Check CORS settings
- Check port 3000 is available

### Audio issues

- Ensure audio is sent in a supported format (PCM 24kHz recommended)
- Check network latency for real-time streaming

## Resources

- [NestJS Docs](https://docs.nestjs.com)
- [Socket.io Docs](https://socket.io/docs/)
- [Google Gemini API](https://ai.google.dev/gemini-api/docs)
