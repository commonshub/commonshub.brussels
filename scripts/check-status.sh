#!/bin/bash

# Check application status
# Usage: ./scripts/check-status.sh [url]

# If no URL provided, try to detect running server
if [ -z "$1" ]; then
  # Try common ports
  for CANDIDATE_PORT in "${PORT:-}" 3033 3000; do
    [ -z "$CANDIDATE_PORT" ] && continue
    if curl -s -f "http://localhost:$CANDIDATE_PORT/status.json" > /dev/null 2>&1; then
      URL="http://localhost:$CANDIDATE_PORT/status.json"
      break
    fi
  done

  # Default if nothing found
  URL="${URL:-http://localhost:${PORT:-3000}/status.json}"
else
  URL="$1"
fi

echo "Checking status at: $URL"
echo ""

# Fetch status and pretty print
curl -s "$URL" | jq '
  {
    "Status": .status,
    "Environment": .environment,
    "Current SHA": .deployment.shortSha,
    "Commit Message": .deployment.message,
    "Commit Date": .deployment.commitDateFormatted,
    "Uptime": .uptime.uptime,
    "Started": .uptime.startedFormatted,
    "Server Time": .server.timeFormatted,
    "Timezone": .server.timezone
  }
' 2>/dev/null

if [ $? -ne 0 ]; then
  echo "Error: Could not fetch status from $URL"
  echo ""
  echo "Is the server running?"
  echo "Try: bun run dev"
  exit 1
fi
