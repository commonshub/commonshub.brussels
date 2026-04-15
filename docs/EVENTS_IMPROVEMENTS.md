# Events System

## Architecture

The events system uses a two-stage process with separation of concerns:

1. **`bun run fetch-events`** - Fetches and caches raw data
   - Downloads iCal feed → `/:year/:month/ical/events.ics`
   - Fetches Luma API data → `/:year/:month/luma/:calendarId.json`

2. **`bun run generate-events`** - Consolidates cached data
   - Reads from iCal and Luma caches
   - Merges data and applies augmentation logic
   - Generates → `/:year/:month/events.json`

## Summary of Changes

### 1. Enhanced Luma Event ID Extraction
- Updated `extractLumaEventId()` to search in both URL and description fields
- Now successfully extracts Luma event IDs from iCal descriptions like "Get up-to-date information at: https://luma.com/m790yr6v"

### 2. Direct Luma API Fetching
- If a Luma event ID is found but not in the calendar events map, the script now attempts to fetch it directly using `getEvent()`
- This ensures we get full Luma data even for events that might not be in the monthly calendar query

### 3. Automatic Attendance Setting
- When a Luma event has `guest_count` data and the metadata doesn't already have an `attendance` value, it automatically sets it
- This ensures attendance data is preserved from Luma

### 4. Enhanced Luma Data Storage
- Added `hosts` field to LumaEvent interface to store event hosts information
- Updated event data storage to include both `hosts` and `hosted_by` fields
- Full Luma event data is now stored in the `lumaData` field including:
  - api_id
  - name
  - description (overrides the generic iCal description)
  - start_at / end_at
  - timezone
  - url
  - cover_url (stored as coverImage in the main event)
  - geo_address_json (location details)
  - meeting_url
  - capacity
  - guest_count
  - hosts / hosted_by

### 5. Open Graph Metadata Fetching
- For non-Luma events with URLs, the script fetches OG metadata
- Extracts og:image to use as coverImage
- Extracts og:title and og:description for better event details

### 6. Test Script
- Created `scripts/test-events-2025-11.ts` to test November 2025 events specifically
- Provides detailed logging of the augmentation process
- Shows which events are matched with Luma, which get OG data, etc.

## Current Data Structure

### events.json
```json
{
  "month": "2025-11",
  "generatedAt": "2025-12-09T15:39:24.435Z",
  "events": [
    {
      "id": "evt-xxx@events.lu.ma",
      "name": "Event Name",
      "description": "Full description from Luma API (or iCal)",
      "startAt": "2025-11-02T12:30:00.000Z",
      "endAt": "2025-11-02T14:30:00.000Z",
      "timezone": "Europe/Brussels",
      "location": "Commons Hub Brussels, Rue de la Madeleine 51, 1000 Bruxelles, Belgium",
      "url": "https://lu.ma/event-slug",
      "coverImage": "https://images.lumacdn.com/...",
      "source": "luma",
      "lumaData": {
        "api_id": "evt-xxx",
        "name": "Event Name",
        "description": "Full description...",
        "guest_count": 25,
        "hosts": [
          { "name": "Host Name", "api_id": "..." }
        ],
        "hosted_by": "Host Name",
        "capacity": 50,
        "cover_url": "https://images.lumacdn.com/...",
        ...
      },
      "metadata": {
        "attendance": 25,
        "fridgeIncome": 45.50,
        "rentalIncome": 100,
        "note": "Great event!"
      }
    }
  ]
}
```

## Usage

### Fetching events
```bash
bun run fetch-events
```
This downloads and caches the iCal feed and Luma API data for all months.

### Generating events.json
```bash
bun run generate-events
```
This reads from the cached data and generates consolidated events.json files.

### Running tests
```bash
bun run test -- tests/events.test.ts
```
Tests validate:
- events.json structure
- Required fields presence
- URL validity
- Date sorting
- Metadata structure
- Cache file integrity

## What Gets Recorded

✅ **Event ID**: Unique identifier (Luma api_id or iCal UID)
✅ **Event URL**: Link to the event page (Luma or custom)
✅ **Cover Image**: Event cover photo from Luma or OG metadata
✅ **Description**: Full description from Luma (overriding generic iCal text)
✅ **Hosts**: List of event hosts from Luma
✅ **Guest Count**: Number of attendees from Luma → sets metadata.attendance
✅ **Location**: Full address from Luma or iCal
✅ **Timezone**: Event timezone
✅ **Start/End Times**: ISO 8601 datetime strings

## Notes

- Without `LUMA_API_KEY`, events will be stored with iCal data only (source: "ical")
- With `LUMA_API_KEY` **and proper permissions**, events are augmented with full Luma data (source: "luma")
- Metadata is always preserved across regenerations
- Cover images for Luma events come from Luma's CDN (requires API access)
- Cover images for non-Luma events come from og:image tags
- Event URLs are constructed from the Luma links in iCal descriptions

## Current Limitations

- The current LUMA_API_KEY returns 404 for all API endpoints, suggesting permission issues
- Events are working correctly with iCal data and constructed URLs
- To enable full Luma API augmentation, the API key needs calendar access permissions
