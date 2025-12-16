# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Set environment variables (can be overridden)
ENV NODE_ENV=production
ENV PORT=3001

# Start the dashboard server
CMD ["bun", "run", "start:dashboard"]

