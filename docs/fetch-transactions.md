# Fetching Transactions

This document explains how to fetch transaction data from various sources (Stripe, blockchain networks like Gnosis and Celo) and populate the local data directory.

## Overview

Transaction data is fetched from multiple sources and stored in monthly cache files organized by year/month:

```
data/
└── {year}/
    └── {month}/
        └── finance/
            ├── stripe/
            │   └── {accountId}.json
            ├── gnosis/
            │   ├── savings.EURe.json
            │   ├── checking.EURe.json
            │   ├── fridge.EURb.json
            │   └── coffee.EURb.json
            └── celo/
                └── cht.json
```

## Prerequisites

### Environment Variables

Before fetching transactions, ensure you have the required API keys configured:

```bash
# Required for Stripe transactions
STRIPE_SECRET_KEY=sk_...

# Required for blockchain transactions
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional: Custom data directory
DATA_DIR=./data
```

Add these to your `.env` file or export them in your shell.

## Quick Start Commands

### Fetch Recent Data (Recommended for Daily Use)

Fetches data for the current month and previous month only. This is fast and ideal for regular updates:

```bash
npm run fetch-recent
```

This runs:
- Transaction fetching (Stripe + blockchain)
- Discord activity
- CHT tokens
- Calendar events
- User data
- Generates aggregated data files

**Use when:**
- Running daily/hourly cron jobs
- You only need recent data
- You want fast builds

### Fetch All Historical Data

Fetches data for all months since the beginning. Warning: This takes a long time on first run!

```bash
npm run fetch-history
```

**Use when:**
- First-time setup
- You need to populate all historical data
- Recovering from data loss

### Fetch Historical Data for a Specific Range

Fetch data for a specific date range:

```bash
# Specific month range
npm run fetch-history -- --start-month=2024-01 --end-month=2024-12

# Single year
npm run fetch-history -- --start-month=2025-01 --end-month=2025-12
```

## Transaction-Specific Commands

### Fetch Transactions Only

If you only want to fetch/update transactions without other data:

```bash
# All months (skips existing historical months, updates current month)
npm run fetch-transactions

# Specific month
npm run fetch-transactions -- --month=2025-11

# Date range
npm run fetch-transactions -- --start-month=2024-01 --end-month=2024-12
```

The script uses: `tsx scripts/warmup-transactions-cache.js`

### Force Re-Populate a Month's Transactions

To force re-fetching transactions for a month that already has cached data, use the `--force` flag:

```bash
# Force re-fetch a specific month
npm run fetch-transactions -- --month=2025-11 --force

# Force re-fetch a date range
npm run fetch-transactions -- --start-month=2024-01 --end-month=2024-12 --force

# Force re-fetch all historical data
npm run fetch-history -- --force
```

The `--force` flag will re-fetch and overwrite cached transaction data even if it already exists.

**What to expect when using `--force`:**
- The script will fetch ALL transactions from the API, not just the current month
- Cached data will be overwritten with fresh data from the API
- Console output will show: `Force mode enabled: Will re-fetch all transactions`
- This is useful for fixing corrupted data or after API configuration changes

**Alternative: Manual deletion (if you prefer)**

You can also delete the cache files manually before re-fetching:

```bash
# Remove the month's transaction data
rm -rf data/2025/11/finance

# Re-fetch that specific month
npm run fetch-transactions -- --month=2025-11
```

Or delete specific account data:

```bash
# Remove specific account file
rm data/2025/11/finance/stripe/acct_1Nn0FaFAhaWeDyow.json
rm data/2025/11/finance/gnosis/savings.EURe.json

# Re-fetch the month
npm run fetch-transactions -- --month=2025-11
```

## Common Use Cases

### Daily Updates (Recommended)

```bash
# Run this daily via cron - fetches only recent data
npm run fetch-recent
```

This is fast and efficient, only fetching current and previous month.

### Fixing Bad Data

```bash
# Re-fetch November 2025 after fixing an API issue
npm run fetch-transactions -- --month=2025-11 --force
```

### Backfilling Historical Data

```bash
# First time setup - fetch all historical data
npm run fetch-history

# Or for a specific year
npm run fetch-history -- --start-month=2024-01 --end-month=2024-12
```

### Testing Configuration Changes

```bash
# Test with a single month before running on all data
npm run fetch-transactions -- --month=2025-11 --force

# If it works, run on all data
npm run fetch-history -- --force
```

## How Transaction Fetching Works

### Caching Strategy

1. **Historical Months** - Once fetched and cached, they are skipped on subsequent runs (data is immutable)
2. **Current Month** - Always re-fetched to capture new transactions
3. **Account-Level Caching** - Each account's transactions are cached separately
4. **Force Mode** - Using `--force` flag bypasses all cache checks and re-fetches everything

### Data Sources

The script fetches from multiple configured accounts in `settings.json`:

```json
{
  "finance": {
    "accounts": [
      {
        "type": "stripe",
        "accountId": "acct_1Nn0FaFAhaWeDyow",
        "name": "Stripe",
        "slug": "stripe"
      },
      {
        "type": "gnosis",
        "chain": "gnosis",
        "address": "0x6fDF0AaE33E313d9C98D2Aa19Bcd8EF777912CBf",
        "name": "Savings (EURe)",
        "slug": "savings",
        "token": "EURe"
      }
    ]
  }
}
```

### File Format

Each cached JSON file contains:

```json
{
  "slug": "savings",
  "balance": 1234.56,
  "lastTransactionTimestamp": 1699564800000,
  "transactions": [
    {
      "id": "0x...",
      "date": "2025-11-15T10:30:00Z",
      "amount": 100.50,
      "currency": "EUR",
      "type": "incoming",
      "description": "Membership payment",
      "from": "0x...",
      "to": "0x...",
      "blockNumber": 12345678,
      "hash": "0x..."
    }
  ]
}
```

## Automated Workflows

### Complete Data Fetching Pipeline

Use `fetch-all-data.ts` for a complete workflow that fetches everything for a specific month:

```bash
# Fetch all data for current month
npm run fetch-data

# Specific month
npm run fetch-data -- --month 11 --year 2025

# Force re-fetch even if data exists
npm run fetch-data -- --month 11 --year 2025 --force
```

This runs a complete pipeline:
1. Fetch calendars (iCal + Luma)
2. Generate events.json
3. Download featured images
4. **Fetch blockchain transactions**
5. Fetch CHT tokens
6. Generate data files (contributors, etc.)
7. Generate transactions.json (aggregated)

## Troubleshooting

### Missing Transactions

**Problem:** Transactions are missing for a specific month

**Solutions:**
1. Check if the cache file exists: `ls -la data/2025/11/finance/stripe/`
2. If it exists, delete it to force re-fetch
3. Check API key configuration
4. Run with specific month: `npm run fetch-transactions -- --month=2025-11`

### API Rate Limits

**Problem:** Script fails with rate limit errors

**Solutions:**
- For Etherscan: Reduce the number of accounts or increase delays
- For Stripe: The script should handle pagination automatically
- Try fetching smaller date ranges

### Incorrect Data

**Problem:** Transaction data appears incorrect or outdated

**Solutions:**
1. Delete the cache file for that month
2. Re-run the fetch command for that specific month
3. Verify your API keys have the correct permissions

### Environment Variables Not Loading

**Problem:** Script says API keys are missing

**Solutions:**
1. Ensure `.env` file is in project root
2. Check that `.env` contains correct keys
3. Try exporting manually: `export STRIPE_SECRET_KEY=sk_...`

## Advanced Usage

### Custom Data Directory

```bash
# Use a different data directory
DATA_DIR=/path/to/data npm run fetch-transactions

# Or set in .env
DATA_DIR=/path/to/data
```

### Fetching for Testing

```bash
# Use test data directory
npm run fetch-transactions -- --month=2025-11
DATA_DIR=./tests/data npm run fetch-transactions -- --month=2025-11
```

### Integration with Cron Jobs

For automated daily updates:

```bash
# Add to crontab (runs at 2 AM daily)
0 2 * * * cd /path/to/project && npm run fetch-recent >> /var/log/fetch-data.log 2>&1
```

## Related Documentation

- [Webhook Deployment](./WEBHOOK_SETUP.md) - Automatic deployment on git push
- See `scripts/warmup-transactions-cache.js` for implementation details
- See `src/lib/transaction-cache.ts` for caching logic
