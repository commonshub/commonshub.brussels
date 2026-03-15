# Stage 0: Build Go CLI
FROM golang:1.22-alpine AS go-builder
WORKDIR /build
RUN apk add --no-cache make
COPY cli/ ./
RUN go mod download
RUN go build -ldflags="-s -w" -trimpath -o chb .

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Git info passed as build args (Coolify provides these)
ARG SOURCE_COMMIT=unknown
ARG COMMIT_MSG=unknown

# Set to "true" to fetch recent data during build (for preview deployments)
ARG FETCH_DATA_ON_BUILD=false

# Stripe key for fetching member data (optional, only needed if FETCH_DATA_ON_BUILD=true)
ARG STRIPE_SECRET_KEY=""
ARG EMAIL_HASH_SALT=""

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate git-info.json from build args
RUN echo "{\"sha\":\"${SOURCE_COMMIT}\",\"message\":\"${COMMIT_MSG}\",\"date\":\"$(date -Iseconds)\"}" > git-info.json
RUN cat git-info.json

RUN npm ci

# Ensure data directory exists (may be populated by fetch-recent)
RUN mkdir -p data

# Copy Go CLI into builder for build-time data fetching
COPY --from=go-builder /build/chb /usr/local/bin/chb

# Fetch recent data during build if requested (for preview deployments)
RUN if [ "$FETCH_DATA_ON_BUILD" = "true" ]; then \
      echo "Fetching recent data during build..." && \
      STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
      EMAIL_HASH_SALT=$EMAIL_HASH_SALT \
      chb events sync || echo "Warning: Events sync failed, continuing anyway"; \
    fi

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl su-exec
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Go CLI binary
COPY --from=go-builder /build/chb /usr/local/bin/chb

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy standalone build (includes minimal node_modules for Next.js server)
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/git-info.json ./git-info.json

# Copy settings (needed by Go CLI at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/src/settings ./src/settings

# Create data directory and copy build-time fetched data if it exists
RUN mkdir -p /data && chown nextjs:nodejs /data
COPY --from=builder --chown=nextjs:nodejs /app/data/ /data/

# DATA_DIR must be /data (not /app/data) to use persistent volume mount
ENV DATA_DIR=/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
