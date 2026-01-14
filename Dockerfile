# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Declare build arguments for environment variables
ARG DISCORD_BOT_TOKEN
ARG LUMA_API_KEY
ARG STRIPE_SECRET_KEY
ARG ETHERSCAN_API_KEY
ARG MONERIUM_CLIENT_ID
ARG MONERIUM_CLIENT_SECRET
ARG RESEND_API_KEY

# Set environment variables from build args
ENV DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN
ENV LUMA_API_KEY=$LUMA_API_KEY
ENV STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
ENV ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY
ENV MONERIUM_CLIENT_ID=$MONERIUM_CLIENT_ID
ENV MONERIUM_CLIENT_SECRET=$MONERIUM_CLIENT_SECRET
ENV RESEND_API_KEY=$RESEND_API_KEY

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Build the application
# Next.js collects anonymous telemetry data, disable it for builds
ENV NEXT_TELEMETRY_DISABLED=1
# Note: Do not fetch data here - data directory will be mounted as a volume
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
