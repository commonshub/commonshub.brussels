---
title: Rooms
description: Room configuration and calendar integration.
---

# Rooms

Rooms are configured in `src/settings/rooms.json` and displayed on the [/rooms](https://commonshub.brussels/rooms) page.

## Configuration

Each room has:

| Field | Description |
|---|---|
| `id` / `slug` | Unique identifier |
| `name` | Display name |
| `capacity` | Max number of people |
| `description` | Full description |
| `pricePerHour` | Price in EUR (0 = free / members only) |
| `tokensPerHour` | Price in CHT (Commons Hub Tokens) |
| `heroImage` | Photo path in `/public/images/` |
| `features` | List of amenities |
| `idealFor` | Suggested use cases |
| `googleCalendarId` | Google Calendar ID for bookings |
| `discordChannelId` | Discord channel for room notifications |
| `membershipRequired` | Whether the room requires membership |

## Current Rooms

| Room | Capacity | Price/hr | Calendar |
|---|---|---|---|
| **Ostrom Room** | 80 | €100 | ✅ |
| **Satoshi Room** | 15 | €50 | ✅ |
| **Angel Room** | 12 | €35 | ✅ |
| **Mush Room** | 10 | €25 | ✅ |
| **Phonebooth** | 1 | €10 | ✅ |
| **Coworking Space** | 30 | Free (members) | ✅ |
| **Playroom** | 10 | €25 | ❌ |

## Calendar Integration

Each room with a `googleCalendarId` gets:

- Its own Google Calendar ICS feed, fetched during `chb events sync`
- Stored as `data/{year}/{month}/calendars/ics/{room-slug}.ics`
- An ICS endpoint at `/rooms/{slug}.ics` on the website
- Room availability shown from the calendar data

The Google Calendar URL is constructed from the calendar ID:

```
https://calendar.google.com/calendar/ical/{encodedCalendarId}/public/basic.ics
```

## Markdown Generation

`generate-md-files.ts` produces `public/rooms.md` with room details, prices, features, and calendar links — useful for LLM discoverability.
