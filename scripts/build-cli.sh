#!/usr/bin/env bash
set -euo pipefail

# Build standalone CLI binaries using Bun and Deno
# Output: dist/chb-bun, dist/chb-deno

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

cd "$PROJECT_DIR"
mkdir -p "$DIST_DIR"

echo "🔨 Building chb CLI binaries..."
echo ""

# ── Bun build ───────────────────────────────────────────────────────────────

echo "📦 Building with Bun..."
bun build --compile --minify --sourcemap=none --outfile "$DIST_DIR/chb-bun" scripts/cli.ts 2>&1
echo ""

# ── Deno build (via Bun bundle → Deno compile) ─────────────────────────────
# Deno doesn't support bare JSON imports or bare Node built-in specifiers,
# so we first bundle with Bun targeting Node, patch the imports, then compile.

echo "📦 Building with Deno..."

# Step 1: Bundle to a single JS file in an isolated directory
# Use /var/tmp to avoid /tmp's stale node_modules being embedded by Deno
BUNDLE_DIR="/var/tmp/chb-deno-build-$$"
rm -rf "$BUNDLE_DIR"
mkdir -p "$BUNDLE_DIR"
bun build --minify --sourcemap=none --target=node --outfile "$BUNDLE_DIR/cli-bundle.mjs" scripts/cli.ts 2>&1

# Step 2: Patch bare Node built-in imports → node: prefixed (Deno requirement)
for mod in fs path https http crypto stream url util events buffer zlib net tls dns querystring string_decoder child_process os assert constants timers process; do
  sed -i "s/require(\"$mod\")/require(\"node:$mod\")/g" "$BUNDLE_DIR/cli-bundle.mjs"
  sed -i "s/from\"$mod\"/from\"node:$mod\"/g" "$BUNDLE_DIR/cli-bundle.mjs"
  sed -i "s/from \"$mod\"/from \"node:$mod\"/g" "$BUNDLE_DIR/cli-bundle.mjs"
done

# Step 3: Compile with Deno from isolated directory (avoids embedding node_modules)
cd "$BUNDLE_DIR"
deno compile --allow-all --no-check --output "$DIST_DIR/chb-deno" cli-bundle.mjs 2>&1
cd "$PROJECT_DIR"
rm -rf "$BUNDLE_DIR"
echo ""

# ── Size comparison ─────────────────────────────────────────────────────────

BUN_SIZE=$(stat -c%s "$DIST_DIR/chb-bun" 2>/dev/null || stat -f%z "$DIST_DIR/chb-bun")
DENO_SIZE=$(stat -c%s "$DIST_DIR/chb-deno" 2>/dev/null || stat -f%z "$DIST_DIR/chb-deno")

fmt_size() {
  local bytes=$1
  echo "$((bytes / 1048576))M"
}

echo "┌─────────────┬──────────┐"
echo "│ Runtime     │ Size     │"
echo "├─────────────┼──────────┤"
printf "│ %-11s │ %8s │\n" "Bun" "$(fmt_size $BUN_SIZE)"
printf "│ %-11s │ %8s │\n" "Deno" "$(fmt_size $DENO_SIZE)"
echo "└─────────────┴──────────┘"
echo ""

# ── Verify binaries work ───────────────────────────────────────────────────

echo "✅ Verifying binaries..."
"$DIST_DIR/chb-bun" --version
"$DIST_DIR/chb-deno" --version
echo ""
echo "Done! Binaries in $DIST_DIR/"
