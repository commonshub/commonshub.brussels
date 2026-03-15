# Transactions

Sync financial transactions from blockchain (Etherscan) and Stripe.

## `chb transactions sync`

Fetches ERC20 token transfers from Etherscan and balance transactions from Stripe, saving them organized by month.

### Syntax

```bash
chb transactions sync [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--month <YYYY-MM>` | Fetch specific month only |
| `--force` | Re-fetch even if cached data exists |
| `--help, -h` | Show help |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ETHERSCAN_API_KEY` | Yes (for blockchain) | Etherscan/Gnosisscan API key |
| `GNOSISSCAN_API_KEY` | No | Fallback API key for Gnosis chain |
| `STRIPE_SECRET_KEY` | Yes (for Stripe) | Stripe secret key |

> If `STRIPE_SECRET_KEY` is not set, Stripe sync is skipped with a warning. Blockchain sync still runs.

### How It Works

**Blockchain sync:**
- Reads account configuration from `src/settings/settings.json` (provider: `etherscan`)
- Fetches ERC20 token transfers via Etherscan V2 API
- Groups transfers by month in Brussels timezone
- Saves per-account, per-token files

**Stripe sync:**
- Reads Stripe account configuration from `src/settings/settings.json` (provider: `stripe`)
- Fetches from Stripe `/v1/balance_transactions` endpoint
- Uses cursor-based pagination (`starting_after`)
- Filters by date range using `created[gte]` and `created[lt]`
- Rate limits: 200ms between pages, auto-retry on HTTP 429
- Saves monthly transaction files

### Data Output

```
data/
├── YYYY/
│   └── MM/
│       └── finance/
│           ├── gnosis/
│           │   ├── savings.EURe.json
│           │   ├── checking.EURe.json
│           │   └── chb-safe.EURe.json
│           └── stripe/
│               └── transactions.json
```

**Blockchain file structure:**
```json
{
  "transactions": [...],
  "cachedAt": "2025-11-15T10:30:00Z",
  "account": "0x...",
  "chain": "gnosis",
  "token": "EURe"
}
```

**Stripe file structure:**
```json
{
  "transactions": [...],
  "cachedAt": "2025-11-15T10:30:00Z",
  "accountId": "acct_...",
  "currency": "EUR"
}
```

### Default Behavior

Without `--month`, syncs the **current month and previous month**. Cached months are skipped unless `--force` is used, except the current month which is always refreshed.

### Examples

```bash
# Sync current + previous month (blockchain + Stripe)
chb transactions sync

# Sync only November 2025
chb transactions sync --month 2025-11

# Force re-fetch everything
chb transactions sync --force

# Blockchain only (no Stripe key set)
ETHERSCAN_API_KEY=xxx chb transactions sync
```
