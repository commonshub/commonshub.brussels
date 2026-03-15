# Bookings

List and sync room booking data from Google Calendar.

## `chb bookings`

List upcoming room bookings from cached calendar data.

### Syntax

```bash
chb bookings [options]
```

### Options

| Flag | Description |
|------|-------------|
| `-n <count>` | Number of bookings to show (default: 10) |
| `--skip <count>` | Skip first N bookings |
| `--date <YYYYMMDD>` | Show bookings for a specific date |
| `--room <slug>` | Filter by room slug |
| `--all` | Show all bookings (no date filter) |
| `--help, -h` | Show help |

### Examples

```bash
# Next 10 upcoming bookings
chb bookings

# Bookings for a specific date
chb bookings --date 20250315

# Only bookings for the Satoshi room
chb bookings --room satoshi

# All bookings, no limit
chb bookings --all
```

---

## `chb bookings sync`

Sync room booking calendars from Google Calendar ICS feeds.

### Syntax

```bash
chb bookings sync [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--room <slug>` | Only sync a specific room |
| `--force` | Re-fetch even if cached data exists |
| `--since <YYYYMMDD>` | Start syncing from this date |
| `--help, -h` | Show help |

### How It Works

- Reads room configuration from `src/settings/rooms.json`
- Each room with a `googleCalendarId` has its ICS feed fetched
- Calendar events are parsed and grouped by month
- Saved as per-room, per-month JSON files

### Data Output

```
data/
├── YYYY/
│   └── MM/
│       └── bookings/
│           ├── satoshi.json
│           ├── ada.json
│           └── {room-slug}.json
```

### Examples

```bash
# Sync all rooms
chb bookings sync

# Sync only one room
chb bookings sync --room satoshi

# Force re-fetch
chb bookings sync --force
```
