# Events

List and sync events from Luma calendar feeds.

## `chb events`

List upcoming events from the local data directory.

### Syntax

```bash
chb events [options]
```

### Options

| Flag | Description |
|------|-------------|
| `-n <count>` | Number of events to show (default: 10) |
| `--since <YYYYMMDD>` | Only events starting after this date (default: today) |
| `--skip <count>` | Skip first N events |
| `--all` | Show all events (no date filter) |
| `--help, -h` | Show help |

### Examples

```bash
# Next 10 upcoming events
chb events

# Next 5 events
chb events -n 5

# All events since January 2025
chb events --since 20250101 --all

# Skip first 10, show next 5
chb events --skip 10 -n 5
```

---

## `chb events sync`

Fetch events from Luma ICS feeds and (optionally) the Luma API for rich metadata.

### Syntax

```bash
chb events sync [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--since <YYYYMMDD>` | Start syncing from this date (default: last month) |
| `--force` | Re-fetch even if cached data exists |
| `--history` | Rebuild entire event history |
| `--help, -h` | Show help |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LUMA_API_KEY` | No | Enables rich event data (covers, guest counts, tags) |

### Data Output

Events are saved to:

```
data/
├── YYYY/
│   ├── MM/
│   │   └── events.json      # Monthly events
│   ├── events.json           # Yearly aggregate
│   └── events.csv            # Yearly CSV export
```

### Sources

- **Luma ICS feed** — calendar events (always used)
- **Luma API** — covers, guests, tags (requires `LUMA_API_KEY`)

### Examples

```bash
# Sync current + previous month
chb events sync

# Sync everything from 2024
chb events sync --since 20240101

# Force re-fetch all cached data
chb events sync --force

# Full history rebuild
chb events sync --history
```
