
# Stage 1: Builder - Build the application with Bun
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install ALL dependencies (including devDependencies)
# Important: Don't use --production flag here since we need build tools
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json nest-cli.json ./

# Build the application
# Option 1: Use bun's built-in rm command
RUN bun run build

# Stage 2: Runtime - Run the application
FROM oven/bun:latest

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package files from builder
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Start the application
CMD ["bun", "run", "dist/main.js"]