# CHB CLI

Command-line tool for managing Commons Hub Brussels data — events, transactions, bookings, messages, and reports.

## Installation

### From source (Go 1.21+)

```bash
git clone https://github.com/commonshub/commonshub.brussels.git
cd commonshub.brussels/cli
make build-small
```

The binary is output to `dist/chb`.

### Add to PATH

```bash
# Move to a directory in your PATH
cp dist/chb /usr/local/bin/

# Or add the dist directory
export PATH="$PATH:$(pwd)/dist"
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
| [`chb events`](cli/events.md) | List and sync events from Luma |
| [`chb transactions sync`](cli/transactions.md) | Sync blockchain + Stripe transactions |
| [`chb bookings`](cli/bookings.md) | List and sync room bookings |
| [`chb messages sync`](cli/messages.md) | Sync Discord messages |
| [`chb rooms`](cli/rooms.md) | List rooms and pricing |
| [`chb report`](cli/report.md) | Generate monthly/yearly reports |

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
