#!/bin/sh
set -e

# Ensure /data directory exists and has correct permissions
# This runs as root before switching to nextjs user
if [ -d "/data" ]; then
    chown -R nextjs:nodejs /data
fi

# Switch to nextjs user and run the command
exec su-exec nextjs "$@"
