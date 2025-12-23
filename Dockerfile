# Stage 1: Builder - Build the application with Bun
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json nest-cli.json ./

# Build the application
RUN bun run build

# Stage 2: Runtime - Run the application
FROM oven/bun:latest

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package files from builder
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production=true

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun run -e "const http = require('http'); const req = http.request('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();" || exit 1

# Start the application
CMD ["bun", "run", "dist/main.js"]