---
title: Scheduled Tasks
description: How data is kept up-to-date via periodic fetching.
---

# Scheduled Tasks

The website relies on pre-generated data files. These are kept fresh through periodic fetching.

## `fetch-recent.js`

The main orchestrator script. Runs all data-fetching scripts for recent months (previous month → next month):

1. **Transactions** — Fetches blockchain transaction data
2. **Discord** — Warms Discord cache
3. **Tokens** — Fetches CHT token data
4. **Events** — Runs `chb events sync` (the full calendar pipeline)
5. **Users** — Warms user cache
6. **Members** — Fetches membership data (current month only)
7. **Data files** — Generates aggregated data files from all fetched data

```bash
npm run fetch-recent
```

## `fetch-all-data.ts`

Fetches and generates all data for a specific month. More targeted than `fetch-recent`:

```bash
npm run fetch-data -- --year 2025 --month 11
npm run fetch-data -- --month 11 --force
```

Runs the full pipeline: calendars → events → images → transactions → tokens → members → data files → transactions.

## Docker Entrypoint

The Docker entrypoint (`docker-entrypoint.sh`) supports `FETCH_DATA_ON_START=true`:

```bash
# If set, runs fetch-recent before starting the server
if [ "$FETCH_DATA_ON_START" = "true" ]; then
    su-exec nextjs npm run fetch-recent
fi
```

This is useful for fresh deployments to populate the data directory.

## Build-time Fetching

The Dockerfile supports `FETCH_DATA_ON_BUILD=true` as a build arg:

```dockerfile
RUN if [ "$FETCH_DATA_ON_BUILD" = "true" ]; then
      npm run fetch-recent || echo "Warning: Data fetch failed";
    fi
```

Used for preview deployments where you want data baked into the image.

## Production Setup

In production, data syncing is typically handled externally (e.g., via a systemd timer, cron job, or CI/CD pipeline) that runs:

```bash
chb events sync
# or
npm run fetch-recent
```

The data directory is mounted as a persistent Docker volume (`/data`), so it survives container restarts.

## How `chb events sync` Fits In

`chb events sync` is the focused events-only sync. It's called by `fetch-recent.js` as the "events" step, but can also be run standalone:

```bash
chb events sync              # sync last month → next 2 months
chb events sync --force      # re-fetch all cached data
chb events sync --history    # rebuild everything
```

It runs: fetch-calendars → generate-events → generate-md-files.
