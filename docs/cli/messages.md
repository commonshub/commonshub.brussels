# Messages

Sync Discord channel messages to the local data directory.

## `chb messages sync`

Fetches messages from configured Discord channels and saves them organized by month.

### Syntax

```bash
chb messages sync [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--month <YYYY-MM>` | Fetch specific month only |
| `--channel <id\|name>` | Fetch specific channel only |
| `--help, -h` | Show help |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token with message read permissions |

### How It Works

- Reads Discord guild and channel configuration from `src/settings/settings.json`
- Fetches all messages from each configured channel via the Discord API
- Groups messages by month in Brussels timezone
- Saves per-channel, per-month JSON files

### Data Output

```
data/
├── YYYY/
│   └── MM/
│       └── discord/
│           ├── general.json
│           ├── events.json
│           └── {channel-name}.json
```

Each file contains an array of Discord message objects with author info, content, attachments, embeds, mentions, and reactions.

### Examples

```bash
# Sync all channels, current + previous month
chb messages sync

# Sync only a specific month
chb messages sync --month 2025-11

# Sync only one channel
chb messages sync --channel general
```
