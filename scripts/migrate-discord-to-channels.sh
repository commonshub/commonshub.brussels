#!/usr/bin/env bash
# Migration script: move data/{year}/{month}/discord/ to data/{year}/{month}/channels/discord/
# Also handles data/latest/discord/ -> data/latest/channels/discord/
#
# Usage: bash scripts/migrate-discord-to-channels.sh
#
# This is safe to run multiple times - it skips directories that have already been migrated.

set -euo pipefail

DATA_DIR="${DATA_DIR:-data}"

migrated=0
skipped=0

for dir in "$DATA_DIR"/*/??/discord "$DATA_DIR"/latest/discord; do
  if [ -d "$dir" ]; then
    parent=$(dirname "$dir")
    target="$parent/channels/discord"

    if [ -d "$target" ]; then
      echo "SKIP: $target already exists"
      skipped=$((skipped + 1))
      continue
    fi

    mkdir -p "$parent/channels"
    mv "$dir" "$target"
    echo "MOVED: $dir -> $target"
    migrated=$((migrated + 1))
  fi
done

echo ""
echo "Migration complete: $migrated moved, $skipped skipped"
