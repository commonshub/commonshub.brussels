# Wallet Address Cache System

## Problem
The `getAccountAddressFromDiscordUserId()` function calls the blockchain to derive wallet addresses from Discord user IDs. This was being called repeatedly for the same users across different scripts, causing:
- Slow execution times
- Unnecessary blockchain calls
- Rate limiting issues
- Higher costs

## Solution
Implemented a persistent cache system that stores Discord user ID to wallet address mappings in `data/wallet-addresses.json`.

## How It Works

### Cache File Location
```
data/wallet-addresses.json
```

### Cache Structure
```json
{
  "689614876515237925": {
    "address": "0x1234...",
    "updatedAt": "2026-01-15T10:30:00.000Z"
  },
  "618897639836090398": {
    "address": "0x5678...",
    "updatedAt": "2026-01-15T10:31:00.000Z"
  }
}
```

### API

```typescript
import {
  getCachedWalletAddress,
  setCachedWalletAddress,
  getWalletCacheStats,
} from "@/lib/wallet-address-cache";

// Get address (returns undefined if not cached, null if address is null)
const address = getCachedWalletAddress(discordUserId);

if (address === undefined) {
  // Not in cache, fetch from blockchain
  const fetchedAddress = await getAccountAddressFromDiscordUserId(discordUserId);
  setCachedWalletAddress(discordUserId, fetchedAddress);
}

// Get cache statistics
const stats = getWalletCacheStats();
console.log(`Cached: ${stats.totalEntries} addresses`);
```

## Updated Components

All places that call `getAccountAddressFromDiscordUserId()` now check the cache first:

### 1. **scripts/generate-data-files.ts**
- `generateContributors()` - Fetches wallet addresses for top 24 contributors
- `generateMonthContributors()` - Fetches addresses for all contributors in a month
- Now shows stats: `"✓ Wallet addresses: X from cache, Y fetched"`

### 2. **scripts/warmup-users-cache.ts**
- Processes Discord users and fetches wallet addresses
- Uses cache to avoid re-fetching known addresses

### 3. **src/app/api/member/[userId]/tokens/route.ts**
- API endpoint for member token data
- Checks cache before blockchain call

### 4. **data/contributors.json**
Now includes `walletAddress` field for each contributor:
```json
{
  "contributors": [
    {
      "id": "689614876515237925",
      "username": "xdamman",
      "displayName": "Xavier",
      "avatar": "...",
      "contributionCount": 27,
      "joinedAt": "2025-11-04T16:31:20.165000+00:00",
      "walletAddress": "0x1234..."
    }
  ]
}
```

## Benefits

1. **Performance**: First run fetches from blockchain, subsequent runs use cache
2. **Cost Reduction**: Fewer blockchain RPC calls
3. **Reliability**: Less prone to rate limiting
4. **Faster Builds**: Scripts complete much faster on subsequent runs

## Cache Management

### View Cache Stats
The cache automatically tracks:
- Total entries
- Entries with addresses
- Entries with null addresses (users without wallets)

### Clear Old Entries
You can optionally clear old cache entries:
```typescript
import { clearOldCacheEntries } from "@/lib/wallet-address-cache";

// Remove entries older than 90 days
const removed = clearOldCacheEntries(90);
```

### Manual Refresh
To force a refresh of specific addresses, simply delete them from `data/wallet-addresses.json`.

## Expected Output

When running `bun run generate-data`:
```
📸 Generating contributors.json...
  ℹ Fetching wallet addresses for 24 contributors...
  ✓ Wallet addresses: 20 from cache, 4 fetched
  ✓ Generated contributors.json (24 contributors, 156 active commoners)
```

First run (cold cache):
- All addresses fetched from blockchain

Subsequent runs (warm cache):
- Most addresses from cache
- Only new contributors fetched

## Notes

- Cache file is in `.gitignore` (via `data/` exclusion)
- Cache persists between script runs
- Safe to delete cache file - it will be regenerated
- Addresses are immutable per Discord user ID, so caching is safe
