#!/bin/bash

# Test webhook endpoint
# Usage: ./scripts/test-webhook.sh [url] [secret]

URL="${1:-http://localhost:3000/api/webhook/deploy}"
SECRET="${2:-${WEBHOOK_SECRET}}"

if [ -z "$SECRET" ]; then
  echo "Error: WEBHOOK_SECRET not set"
  echo "Usage: ./scripts/test-webhook.sh [url] [secret]"
  echo "Or set WEBHOOK_SECRET environment variable"
  exit 1
fi

# Create test payload (simulating GitHub push event)
PAYLOAD='{
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "commonshub/commonshub.brussels"
  },
  "pusher": {
    "name": "test-user"
  },
  "head_commit": {
    "id": "abc1234567890",
    "message": "Test deployment"
  }
}'

# Generate signature (same way GitHub does it)
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

echo "Testing webhook endpoint: $URL"
echo ""
echo "Payload:"
echo "$PAYLOAD" | jq .
echo ""
echo "Signature: sha256=$SIGNATURE"
echo ""
echo "Sending request..."
echo ""

# Send request with signature
curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  -v

echo ""
echo ""
echo "Done!"
