#!/bin/sh
set -e

# ============================================================
# Generate git-info.json from SOURCE_COMMIT env var (set by Coolify)
# ============================================================
if [ -n "$SOURCE_COMMIT" ]; then
    COMMIT_MSG=$(curl -sf "https://api.github.com/repos/CommonsHub/commonshub.brussels/commits/$SOURCE_COMMIT" 2>/dev/null | grep -o '"message": *"[^"]*"' | head -1 | sed 's/"message": *"//;s/"$//' | head -c 100 || echo "unknown")
    COMMIT_MSG=$(echo "$COMMIT_MSG" | sed 's/"/\\"/g' | tr '\n' ' ')
    echo "{\"sha\":\"$SOURCE_COMMIT\",\"message\":\"$COMMIT_MSG\",\"date\":\"$(date -Iseconds)\"}" > /app/git-info.json
    chown nextjs:nodejs /app/git-info.json 2>/dev/null || true
fi

# ============================================================
# Ensure /data directory exists and has correct permissions
# ============================================================
if [ -d "/data" ]; then
    chown -R nextjs:nodejs /data
fi

# ============================================================
# Optional DNS-level domain whitelisting
#
# This is useful in tightly controlled environments, but many container
# platforms manage /etc/hosts and related files themselves. Keep it opt-in
# so the app starts reliably on hosts like Coolify.
# ============================================================
ENABLE_DNS_SANDBOX="${ENABLE_DNS_SANDBOX:-0}"
DOMAINS_FILE="/app/sandbox-domains.conf"
if [ "$ENABLE_DNS_SANDBOX" = "1" ]; then
    if [ -f "$DOMAINS_FILE" ]; then
        echo "[sandbox] Setting up DNS domain whitelist..."

        # Build /etc/hosts with pre-resolved whitelisted domains
        cat > /tmp/sandbox-hosts <<EOF
127.0.0.1 localhost
::1       localhost
EOF

        while IFS= read -r line; do
            # Strip comments and whitespace
            line=$(echo "$line" | sed 's/#.*//' | tr -d ' ')
            [ -z "$line" ] && continue
            [ "$line" = "localhost" ] && continue

            # Resolve domain to IP (Alpine uses musl's getent)
            ip=$(getent ahostsv4 "$line" 2>/dev/null | awk 'NR==1{print $1}' || true)
            if [ -n "$ip" ]; then
                echo "$ip $line" >> /tmp/sandbox-hosts
                echo "  $line -> $ip"
            else
                echo "  [warn] Could not resolve: $line"
            fi
        done < "$DOMAINS_FILE"

        # /etc/hosts is a Docker-managed mount, so overwrite contents in place.
        cat /tmp/sandbox-hosts > /etc/hosts

        # nsswitch.conf: only use /etc/hosts, no DNS queries
        echo "hosts: files" > /etc/nsswitch.conf

        # resolv.conf: dead nameserver as fallback (RFC 5737 TEST-NET)
        echo "nameserver 192.0.2.1" > /etc/resolv.conf
        echo "options timeout:1 attempts:1" >> /etc/resolv.conf

        rm -f /tmp/sandbox-hosts

        DOMAIN_COUNT=$(grep -v '^#' "$DOMAINS_FILE" | grep -v '^\s*$' | wc -l)
        echo "[sandbox] DNS whitelist active: $DOMAIN_COUNT domains allowed"
    else
        echo "[sandbox] WARNING: sandbox-domains.conf not found, DNS is unrestricted"
    fi
else
    echo "[sandbox] DNS whitelist disabled in container startup"
fi

# ============================================================
# Switch to nextjs user and run the command
# ============================================================
exec su-exec nextjs "$@"
