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

# Fetch recent data during build if requested (for preview deployments)
RUN if [ "$FETCH_DATA_ON_BUILD" = "true" ]; then \
      echo "Fetching recent data during build..." && \
      STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY \
      EMAIL_HASH_SALT=$EMAIL_HASH_SALT \
      npm run fetch-recent || echo "Warning: Data fetch failed, continuing anyway"; \
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

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy standalone build (includes minimal node_modules for Next.js server)
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/git-info.json ./git-info.json

# Copy scripts and their required source files
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib
COPY --from=builder --chown=nextjs:nodejs /app/src/types ./src/types
COPY --from=builder --chown=nextjs:nodejs /app/src/settings ./src/settings
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Merge production dependencies for fetch scripts into standalone node_modules
# Scripts need dotenv, stripe, tsx etc. which are now in dependencies
COPY --from=deps /app/node_modules /tmp/node_modules_prod
RUN cp -rn /tmp/node_modules_prod/* node_modules/ && rm -rf /tmp/node_modules_prod

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
