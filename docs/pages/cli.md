---
title: CLI Tool
description: The chb command-line tool for managing Commons Hub Brussels data.
---

# chb CLI

`chb` is the CLI tool for listing and syncing Commons Hub Brussels event data.

## Running

```bash
# Via bun (direct)
bun scripts/cli.ts

# Via npm script
npm run chb

# With arguments
npm run chb -- events -n 5
```

## Commands

### `chb events`

List events from the local `data/` directory.

```bash
chb events [options]
```

| Option | Description |
|---|---|
| `-n <count>` | Number of events to show (default: 10) |
| `--since <YYYYMMDD>` | Only events starting after this date (default: today) |
| `--skip <count>` | Skip first N events |
| `--all` | Show all events (no date filter) |

**Examples:**

```bash
chb events                          # next 10 upcoming
chb events -n 5                     # next 5
chb events --since 20260401 -n 20   # 20 events from April
chb events --all --skip 10 -n 10    # page through all events
```

**Output** is a formatted table with date, time, title, tags, and URL.

### `chb events sync`

Fetch events from calendar feeds and regenerate data files.

```bash
chb events sync [options]
```

| Option | Description |
|---|---|
| `--since <YYYYMMDD>` | Start syncing from this date (default: last month) |
| `--force` | Re-fetch even if cached data exists |
| `--history` | Rebuild entire event history |

The sync pipeline runs three steps:

1. **Fetch calendars** — Downloads Luma ICS, Google Calendar ICS, and Luma API data
2. **Generate events** — Consolidates all sources into `events.json` per month (+ yearly aggregates and CSV)
3. **Update markdown** — Regenerates `public/events.md` and `public/rooms.md` for LLM discoverability

**Examples:**

```bash
chb events sync                     # sync recent months
chb events sync --force             # re-fetch everything
chb events sync --since 20260101    # from January 2026
chb events sync --history           # full rebuild
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATA_DIR` | Data directory path (default: `./data`) |
| `LUMA_API_KEY` | Luma API key — enables rich event data (covers, guests, tags). Without it, only ICS data is used. |

## Version

```bash
chb --version   # chb v1.0.0
```
