---
title: Data Directory
description: Structure of the data/ directory that powers the website.
---

# Data Directory

All fetched and generated data lives in `data/`, organized by year and month. This directory is mounted as a persistent volume in Docker (`/data`) and excluded from git.

## Directory Structure

```
data/
  {year}/
    {month}/
      events.json                    — consolidated events for the month
      calendars/
        ics/
          luma.ics                   — raw Luma ICS feed (split by month)
          google.ics                 — raw Google Calendar ICS
          {room-slug}.ics            — per-room Google Calendar ICS
          images/                    — downloaded og:image for ICS events
        luma/
          {calendarId}.json          — raw Luma API response
          images/                    — downloaded cover images
          private/
            guests/
              {eventId}.json         — guest lists (not public)
      {chain}/
        {token}/
          {address}.json             — blockchain transactions
    events.json                      — yearly aggregated events
    events.csv                       — yearly CSV export
  latest/
    events.json                      — copy of most recent month's events
    calendars/                       — copy of most recent month's calendars
```

## Key Files

### `events.json` (monthly)

The core data file. Contains all events for a month with:

- Event metadata (id, name, description, dates, location, URL)
- Cover images (original URL + local path)
- Source tracking (`luma-api`, `luma`, `google`)
- Tags from Luma API
- Guest lists (approved guests only, no emails)
- Financial metadata: ticket sales, fridge income (from on-chain transactions), rental income

Structure:

```json
{
  "month": "2026-03",
  "generatedAt": "2026-03-13T14:00:00.000Z",
  "events": [
    {
      "id": "evt-xxx",
      "name": "Event Name",
      "startAt": "2026-03-15T18:00:00.000Z",
      "endAt": "2026-03-15T21:00:00.000Z",
      "source": "luma",
      "calendarSource": "luma-api",
      "tags": [{ "name": "workshop", "color": "#6b7280" }],
      "metadata": {
        "attendance": 42,
        "fridgeIncome": 15.50,
        "ticketsSold": 10,
        "ticketRevenue": 50.00
      }
    }
  ]
}
```

### `events.json` (yearly)

Aggregation of all monthly `events.json` files for a given year. Same schema.

### `events.csv` (yearly)

CSV export with columns: Event ID, Calendar Source, Date, Time, Event Name, Host, Attendance, Tickets Sold, Ticket Revenue, Fridge Income, Rental Income, Location, URL, Note.

### Luma API cache (`calendars/luma/{calendarId}.json`)

Raw Luma API response — array of event objects with full metadata (api_id, cover_url, geo_address_json, hosts, capacity, etc.).

### Guest files (`calendars/luma/private/guests/{eventId}.json`)

Per-event guest lists from Luma API. Stored under `private/` — excluded from git via `*/private/*` in `.gitignore`.

### Blockchain transactions (`{chain}/{token}/{address}.json`)

On-chain transaction history for configured accounts (fridge, coffee, etc.). Used to compute fridge income per event.

## Environment

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Path to the data directory |

In Docker, `DATA_DIR=/data` and the directory is mounted as a persistent volume.
