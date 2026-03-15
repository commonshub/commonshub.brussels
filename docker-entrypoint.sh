#!/bin/sh
set -e

# Generate git-info.json from SOURCE_COMMIT env var (set by Coolify)
if [ -n "$SOURCE_COMMIT" ]; then
    # Fetch commit message from GitHub API (public repo, no auth needed)
    COMMIT_MSG=$(curl -sf "https://api.github.com/repos/CommonsHub/commonshub.brussels/commits/$SOURCE_COMMIT" 2>/dev/null | grep -o '"message": *"[^"]*"' | head -1 | sed 's/"message": *"//;s/"$//' | head -c 100 || echo "unknown")
    # Escape quotes in message for JSON
    COMMIT_MSG=$(echo "$COMMIT_MSG" | sed 's/"/\\"/g' | tr '\n' ' ')
    echo "{\"sha\":\"$SOURCE_COMMIT\",\"message\":\"$COMMIT_MSG\",\"date\":\"$(date -Iseconds)\"}" > /app/git-info.json
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
    su-exec nextjs chb events sync || echo "Warning: Events sync failed, continuing anyway"
    su-exec nextjs chb transactions sync || echo "Warning: Transactions sync failed, continuing anyway"
    su-exec nextjs chb bookings sync || echo "Warning: Bookings sync failed, continuing anyway"
fi

# Switch to nextjs user and run the command
exec su-exec nextjs "$@"
