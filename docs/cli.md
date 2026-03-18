# CHB CLI

Command-line tool for managing Commons Hub Brussels data — events, transactions, bookings, messages, and reports.

The CLI lives in its own repository: [CommonsHub/cli](https://github.com/CommonsHub/cli)

## Installation

### Using Go (1.22+)

```bash
go install github.com/CommonsHub/cli/cmd/chb@latest
```

### From source

```bash
git clone https://github.com/CommonsHub/cli.git
cd cli
go build -o chb ./cmd/chb
```

## Quick Start

```bash
# List upcoming events
chb events

# Sync all data
chb events sync
chb transactions sync
chb bookings sync
chb messages sync

# Generate a monthly report
chb report 2025/11
```

## Commands

| Command | Description |
|---------|-------------|
| `chb events` | List and sync events from Luma |
| `chb transactions sync` | Sync blockchain + Stripe transactions |
| `chb bookings` | List and sync room bookings |
| `chb messages sync` | Sync Discord messages |
| `chb rooms` | List rooms and pricing |
| `chb report` | Generate monthly/yearly reports |
| `chb members sync` | Fetch membership data from Stripe/Odoo |
| `chb generate` | Generate derived data files |
| `chb sync` | Sync everything |

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `DATA_DIR` | All commands | Data directory (default: `./data`) |
| `LUMA_API_KEY` | `events sync` | Luma API key for rich event data |
| `ETHERSCAN_API_KEY` | `transactions sync` | Etherscan/Gnosisscan API key |
| `GNOSISSCAN_API_KEY` | `transactions sync` | Fallback API key for Gnosis chain |
| `STRIPE_SECRET_KEY` | `transactions sync` | Stripe secret key |
| `DISCORD_BOT_TOKEN` | `messages sync` | Discord bot token |

## Data Directory Structure

All data is stored in a year/month hierarchy:

```
data/
├── 2025/
│   ├── 01/
│   │   ├── events.json
│   │   ├── bookings/
│   │   │   └── {room-slug}.json
│   │   ├── finance/
│   │   │   ├── gnosis/
│   │   │   │   └── {account}.{token}.json
│   │   │   └── stripe/
│   │   │       └── transactions.json
│   │   └── discord/
│   │       └── {channel-name}.json
│   ├── events.json          # yearly aggregate
│   └── events.csv           # yearly CSV export
```

## Global Options

```
--help, -h       Show help for any command
--version, -v    Show CLI version
```
