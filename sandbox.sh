#!/usr/bin/env bash
# sandbox.sh - Run commands in a bwrap sandbox with filesystem isolation
#              and DNS-level domain whitelisting.
#
# Protection:
#   Filesystem: Project dir and DATA_DIR are mounted read-only by default.
#               Only explicit scratch paths such as .next are writable.
#               No access to ~/.ssh, ~/.gnupg, ~/.config, or anything outside
#               the project.
#   Network:    Only whitelisted domains can be resolved. Custom nsswitch.conf
#               restricts glibc to /etc/hosts only (no DNS queries). A dead
#               resolv.conf blocks c-ares (Node.js dns.resolve) as fallback.
#
# Usage:
#   ./sandbox.sh                   # default: bun dev
#   ./sandbox.sh bun run build     # build
#   ./sandbox.sh node server.js    # production
#   ./sandbox.sh --no-network bun run build   # fully offline (no network)
#
# Domain whitelist is loaded from sandbox-domains.conf in the same directory.
#
# Requirements: bwrap (bubblewrap), getent

set -euo pipefail

# ============================================================
# Parse arguments
# ============================================================
NO_NETWORK=false
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--no-network" ]]; then
    NO_NETWORK=true
  else
    ARGS+=("$arg")
  fi
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

# ============================================================
# Resolve paths
# ============================================================
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load DATA_DIR from .env.local if not set
if [[ -z "${DATA_DIR:-}" ]] && [[ -f "$PROJECT_DIR/.env.local" ]]; then
  DATA_DIR=$(grep '^DATA_DIR=' "$PROJECT_DIR/.env.local" 2>/dev/null | cut -d= -f2- || true)
fi
DATA_DIR="${DATA_DIR:-$HOME/.chb/data}"
DATA_DIR="${DATA_DIR/#\~/$HOME}"
mkdir -p "$DATA_DIR"

report_dir_state() {
  local dir="$1"
  local label="$2"

  if [[ ! -e "$dir" ]]; then
    echo "[sandbox] $label: $dir (missing)"
    return
  fi

  if [[ ! -d "$dir" ]]; then
    echo "[sandbox] $label: $dir (not a directory)"
    return
  fi

  local size
  size=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
  echo "[sandbox] $label: $dir ($size)"
}

report_data_dir() {
  report_dir_state "$DATA_DIR" "DATA_DIR"

  mapfile -t year_dirs < <(find "$DATA_DIR" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{4}' | sort)
  if [[ ${#year_dirs[@]} -eq 0 ]]; then
    echo "[sandbox] DATA_DIR has no year/month directories"
    return
  fi

  for year_dir in "${year_dirs[@]}"; do
    year=$(basename "$year_dir")
    report_dir_state "$year_dir" "$year"

    mapfile -t month_dirs < <(find "$year_dir" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{2}' | sort)
    for month_dir in "${month_dirs[@]}"; do
      month=$(basename "$month_dir")
      report_dir_state "$month_dir" "$year/$month"
    done
  done
}

# ============================================================
# Load whitelisted domains from sandbox-domains.conf
# ============================================================
DOMAINS_FILE="$PROJECT_DIR/sandbox-domains.conf"
if [[ ! -f "$DOMAINS_FILE" ]]; then
  echo "Error: $DOMAINS_FILE not found" >&2
  exit 1
fi

ALLOWED_DOMAINS=(localhost)
while IFS= read -r line; do
  line="${line%%#*}"        # strip comments
  line="${line// /}"        # strip spaces
  [[ -z "$line" ]] && continue
  ALLOWED_DOMAINS+=("$line")
done < "$DOMAINS_FILE"

# ============================================================
# Preflight checks
# ============================================================
if ! command -v bwrap &>/dev/null; then
  echo "Error: bwrap (bubblewrap) is not installed." >&2
  echo "Install: sudo pacman -S bubblewrap" >&2
  exit 1
fi

# ============================================================
# Build sandbox /etc files for DNS filtering
# ============================================================
SANDBOX_DIR=$(mktemp -d /tmp/sandbox-etc.XXXXXX)
NEXT_TMP_DIR=$(mktemp -d /tmp/sandbox-next.XXXXXX)
DATA_TMP_DIR=$(mktemp -d /tmp/sandbox-data-tmp.XXXXXX)
trap 'rm -rf "$SANDBOX_DIR" "$NEXT_TMP_DIR" "$DATA_TMP_DIR"' EXIT

HOSTS_FILE="$SANDBOX_DIR/hosts"
NSSWITCH_FILE="$SANDBOX_DIR/nsswitch.conf"
RESOLV_FILE="$SANDBOX_DIR/resolv.conf"

# -- /etc/hosts: pre-resolved whitelisted domains only --
cat > "$HOSTS_FILE" <<EOF
127.0.0.1 localhost
::1       localhost
EOF

if [[ "$NO_NETWORK" == false ]]; then
  echo "[sandbox] Resolving whitelisted domains..."
  for domain in "${ALLOWED_DOMAINS[@]}"; do
    [[ "$domain" == "localhost" ]] && continue
    # Resolve to first IPv4 address
    ip=$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR==1{print $1}' || true)
    if [[ -n "$ip" ]]; then
      echo "$ip $domain" >> "$HOSTS_FILE"
      echo "  $domain -> $ip"
    else
      echo "  [warn] Could not resolve: $domain"
    fi
  done
fi

# -- /etc/nsswitch.conf: glibc uses ONLY /etc/hosts, no DNS --
echo "hosts: files" > "$NSSWITCH_FILE"

# -- /etc/resolv.conf: dead nameserver (blocks c-ares bypass) --
# 192.0.2.1 is TEST-NET-1 (RFC 5737), guaranteed non-routable
cat > "$RESOLV_FILE" <<EOF
nameserver 192.0.2.1
options timeout:1 attempts:1
EOF

# ============================================================
# Detect runtime binary path
# ============================================================
RUNTIME_CMD="${1:-bun}"
RUNTIME_PATH=$(command -v "$RUNTIME_CMD" 2>/dev/null || true)
if [[ -z "$RUNTIME_PATH" ]]; then
  echo "Error: '$RUNTIME_CMD' not found in PATH" >&2
  exit 1
fi
RUNTIME_REAL=$(readlink -f "$RUNTIME_PATH")
RUNTIME_DIR=$(dirname "$RUNTIME_REAL")

# mise install directory (where node/bun binaries live)
MISE_DIR="$HOME/.local/share/mise"

# ============================================================
# Build bwrap arguments
# ============================================================
BWRAP_ARGS=()

# -- Minimal read-only system --
BWRAP_ARGS+=(--ro-bind /usr /usr)

# Arch Linux: /bin, /sbin, /lib, /lib64 are symlinks to /usr/*
if [[ -L /bin ]]; then
  BWRAP_ARGS+=(--symlink /usr/bin /bin)
  BWRAP_ARGS+=(--symlink /usr/bin /sbin)
  BWRAP_ARGS+=(--symlink /usr/lib /lib)
  BWRAP_ARGS+=(--symlink /usr/lib /lib64)
else
  # Non-Arch: real directories
  for dir in /bin /sbin /lib; do
    [[ -d "$dir" ]] && BWRAP_ARGS+=(--ro-bind "$dir" "$dir")
  done
  [[ -d /lib64 ]] && BWRAP_ARGS+=(--ro-bind /lib64 /lib64)
fi

# -- Selective /etc (no ~/.ssh, no secrets) --
BWRAP_ARGS+=(
  --ro-bind /etc/ssl             /etc/ssl
  --ro-bind /etc/ld.so.cache     /etc/ld.so.cache
  --ro-bind /etc/ld.so.conf      /etc/ld.so.conf
  --ro-bind /etc/passwd          /etc/passwd
  --ro-bind /etc/group           /etc/group
)
[[ -d /etc/ca-certificates ]] && BWRAP_ARGS+=(--ro-bind /etc/ca-certificates /etc/ca-certificates)

# -- Sandboxed /etc files (DNS filtering) --
BWRAP_ARGS+=(
  --ro-bind "$HOSTS_FILE"     /etc/hosts
  --ro-bind "$NSSWITCH_FILE"  /etc/nsswitch.conf
  --ro-bind "$RESOLV_FILE"    /etc/resolv.conf
)

# -- Process / device / tmp --
BWRAP_ARGS+=(
  --proc /proc
  --dev /dev
  --tmpfs /tmp
  --tmpfs /run
)

# -- Empty $HOME (blocks ~/.ssh, ~/.gnupg, ~/.config, etc.) --
BWRAP_ARGS+=(--tmpfs "$HOME")

# -- Mount project dir + data dir read-only into the empty $HOME --
BWRAP_ARGS+=(
  --ro-bind "$PROJECT_DIR" "$PROJECT_DIR"
  --ro-bind "$DATA_DIR"    "$DATA_DIR"
)

# Next.js dev/build need a writable output directory even when source is read-only.
BWRAP_ARGS+=(
  --dir "$PROJECT_DIR/.next"
  --bind "$NEXT_TMP_DIR" "$PROJECT_DIR/.next"
)

# The image proxy caches resized images in DATA_DIR/tmp on cache miss.
BWRAP_ARGS+=(
  --dir "$DATA_DIR/tmp"
  --bind "$DATA_TMP_DIR" "$DATA_DIR/tmp"
)

# -- Runtime binaries (read-only) --
if [[ -d "$MISE_DIR" ]]; then
  BWRAP_ARGS+=(--ro-bind "$MISE_DIR" "$MISE_DIR")
fi

# -- Network isolation --
if [[ "$NO_NETWORK" == true ]]; then
  BWRAP_ARGS+=(--unshare-net)
fi

# -- Process isolation --
BWRAP_ARGS+=(
  --unshare-pid
  --unshare-uts
  --unshare-ipc
  --new-session
  --die-with-parent
  --chdir "$PROJECT_DIR"
)

# -- Environment: start clean, pass only what's needed --
BWRAP_ARGS+=(
  --clearenv
  --setenv HOME    "$HOME"
  --setenv USER    "$USER"
  --setenv PATH    "$RUNTIME_DIR:/usr/bin:/bin"
  --setenv TERM    "${TERM:-xterm-256color}"
  --setenv DATA_DIR "$DATA_DIR"
  --setenv NODE_ENV "${NODE_ENV:-development}"
)

# Pass through vars from .env.local
if [[ -f "$PROJECT_DIR/.env.local" ]]; then
  while IFS= read -r line; do
    # Skip comments and empty lines
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    # Don't override what we already set
    [[ "$key" == "DATA_DIR" || "$key" == "NODE_ENV" || "$key" == "HOME" || "$key" == "PATH" ]] && continue
    BWRAP_ARGS+=(--setenv "$key" "$value")
  done < "$PROJECT_DIR/.env.local"
fi

# ============================================================
# Default command
# ============================================================
if [[ $# -eq 0 ]]; then
  set -- bun dev
fi

# ============================================================
# Launch
# ============================================================
echo ""
echo "[sandbox] Filesystem: $PROJECT_DIR and $DATA_DIR are read-only"
echo "[sandbox] Scratch:    $PROJECT_DIR/.next is writable inside the sandbox"
echo "[sandbox] Scratch:    $DATA_DIR/tmp is writable inside the sandbox"
echo "[sandbox] process.env.DATA_DIR: ${DATA_DIR}"
report_data_dir
echo "[sandbox] Network:    $(if $NO_NETWORK; then echo "BLOCKED (offline mode)"; else echo "${#ALLOWED_DOMAINS[@]} whitelisted domains"; fi)"
echo "[sandbox] Command:    $*"
echo ""

exec bwrap "${BWRAP_ARGS[@]}" -- "$@"
