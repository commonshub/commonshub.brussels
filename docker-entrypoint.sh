#!/bin/sh
set -e

# Ensure /app/data directory exists and has correct permissions
# This runs as root before switching to nextjs user
# App expects DATA_DIR at /app/data (cwd + "/data")
if [ -d "/app/data" ]; then
    chown -R nextjs:nodejs /app/data
fi

# Fetch recent data if FETCH_DATA_ON_START is set
if [ "$FETCH_DATA_ON_START" = "true" ]; then
    echo "Fetching recent data..."
    su-exec nextjs npx tsx scripts/fetch-all-data.ts --recent || echo "Warning: Data fetch failed, continuing anyway"
fi

# Switch to nextjs user and run the command
exec su-exec nextjs "$@"
