---
title: Events Pipeline
description: How events are fetched, consolidated, and served on the website.
---

# Events Pipeline

Events flow from external calendars through a multi-step pipeline into the website.

## Sources

### Luma ICS Feed

The primary source: an ICS feed from the Luma calendar (`cal-kWlIiw3HsJFhs25`).

- URL configured in `settings.json` → `calendars.luma`
- Contains all events on the Commons Hub Luma calendar
- **Limitation:** Only includes events created by the calendar owner. Community events (hosted by others on the same calendar) do NOT appear in the ICS feed.

### Luma API

Rich event data fetched per-month from the Luma API using `calendarId` from `settings.json` → `luma.calendarId`.

- Provides: cover images, guest lists, tags, capacity, host info, descriptions
- **Includes community events** — this is the only source for events hosted by others
- Requires `LUMA_API_KEY` environment variable
- Data stored as `calendars/luma/{calendarId}.json` per month

### Google Calendar ICS

Room booking data from Google Calendar.

- URL configured in `settings.json` → `calendars.google`
- Each room in `rooms.json` also has its own `googleCalendarId` for individual room calendars
- Stored as `calendars/ics/google.ics` per month

## Pipeline Steps

### 1. `fetch-calendars`

(`scripts/fetch-calendars.ts`)

- Fetches Luma ICS feed → splits by month → saves as `calendars/ics/luma.ics`
- Fetches Google Calendar ICS → splits by month → saves as `calendars/ics/google.ics`
- Fetches individual room calendars → saves as `calendars/ics/{room-slug}.ics`
- Fetches Luma API data per month → saves as `calendars/luma/{calendarId}.json`
- Downloads cover images (og:image from ICS event URLs, cover_url from Luma API)
- Fetches guest lists per event → saves to `calendars/luma/private/guests/`
- Skips existing data unless `--force` is set

### 2. `generate-events`

(`scripts/generate-events.ts`)

Consolidates all cached data into `events.json`:

1. Loads events from `luma.ics` (single source of truth for public events)
2. Matches each ICS event to Luma API data by event ID or name
3. For unmatched `evt-*` IDs, fetches directly from Luma API (catches community events)
4. Adds any Luma API events not found in the ICS feed (community events)
5. Enriches with: cover images, guest lists, tags, ticket stats, fridge income (from blockchain tx)
6. Preserves manually-set metadata (host, attendance, notes) across regenerations
7. Outputs:
   - `data/{year}/{month}/events.json` — monthly events
   - `data/{year}/events.json` — yearly aggregate
   - `data/{year}/events.csv` — yearly CSV export
   - `data/latest/events.json` — symlink to most recent month

### 3. `generate-md-files`

(`scripts/generate-md-files.ts`)

Generates markdown files in `public/` for LLM discoverability:

- `public/events.md` — upcoming events with dates, times, locations, descriptions
- `public/rooms.md` — room details with capacities, prices, features, calendar links

## Website API

The Next.js API route (`src/app/api/events/route.ts`) reads directly from `data/`:

- Scans current month + next 2 months of `events.json` files
- Filters to future events only
- Detects external events (non-Luma URLs) and their platform
- Caches in memory for 5 minutes
- Returns JSON with events, tags, and featured flags

## Settings

Relevant config in `src/settings/settings.json`:

```json
{
  "luma": {
    "calendarId": "cal-kWlIiw3HsJFhs25"
  },
  "calendars": {
    "google": "https://calendar.google.com/calendar/ical/...public/basic.ics",
    "luma": "https://api2.luma.com/ics/get?entity=calendar&id=cal-kWlIiw3HsJFhs25"
  }
}
```
