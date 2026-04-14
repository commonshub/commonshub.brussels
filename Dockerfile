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

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate git-info.json from build args
RUN echo "{\"sha\":\"${SOURCE_COMMIT}\",\"message\":\"${COMMIT_MSG}\",\"date\":\"$(date -Iseconds)\"}" > git-info.json
RUN cat git-info.json

# Ensure data directory exists
RUN mkdir -p data

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm ci
RUN npm run build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG CHB_VERSION=v2.2.4

RUN apk add --no-cache bash curl libc6-compat su-exec tar
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install the CHB CLI using the documented release-download flow from CommonsHub/chb.
RUN ARCH=amd64 \
 && VERSION="$CHB_VERSION" \
 && curl -fsSL -o /tmp/chb.tar.gz "https://github.com/CommonsHub/chb/releases/download/${VERSION}/chb_${VERSION#v}_linux_${ARCH}.tar.gz" \
 && curl -fsSL -o /tmp/checksums.txt "https://github.com/CommonsHub/chb/releases/download/${VERSION}/checksums.txt" \
 && EXPECTED_SHA="$(grep " chb_${VERSION#v}_linux_${ARCH}.tar.gz$" /tmp/checksums.txt | awk '{print $1}')" \
 && ACTUAL_SHA="$(sha256sum /tmp/chb.tar.gz | awk '{print $1}')" \
 && [ -n "$EXPECTED_SHA" ] \
 && [ "$EXPECTED_SHA" = "$ACTUAL_SHA" ] \
 && tar -xzf /tmp/chb.tar.gz -C /tmp \
 && install /tmp/chb_${VERSION#v}_linux_${ARCH} /usr/local/bin/chb \
 && rm -f /tmp/chb.tar.gz /tmp/checksums.txt /tmp/chb_${VERSION#v}_linux_${ARCH} \
 && /usr/local/bin/chb --version

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

# Copy sandbox domain whitelist (used by entrypoint for DNS filtering)
COPY sandbox-domains.conf ./sandbox-domains.conf

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
