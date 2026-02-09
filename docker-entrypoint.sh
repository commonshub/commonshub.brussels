#!/bin/sh
set -e

# Generate git-info.json from SOURCE_COMMIT env var (set by Coolify)
if [ -n "$SOURCE_COMMIT" ]; then
    echo "{\"sha\":\"$SOURCE_COMMIT\",\"message\":\"${COOLIFY_BRANCH:-main}\",\"date\":\"$(date -Iseconds)\"}" > /app/git-info.json
    chown nextjs:nodejs /app/git-info.json 2>/dev/null || true
fi

# Ensure /data directory exists and has correct permissions
# This runs as root before switching to nextjs user
if [ -d "/data" ]; then
    chown -R nextjs:nodejs /data
fi

# Fetch recent data if FETCH_DATA_ON_START is set
if [ "$FETCH_DATA_ON_START" = "true" ]; then
    echo "Fetching recent data..."
    su-exec nextjs npx tsx scripts/fetch-all-data.ts --recent || echo "Warning: Data fetch failed, continuing anyway"
fi

# Switch to nextjs user and run the command
exec su-exec nextjs "$@"
