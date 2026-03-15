# Rooms

List all available rooms with pricing and features.

## `chb rooms`

Displays a formatted table of all rooms configured in `src/settings/rooms.json`.

### Syntax

```bash
chb rooms [--help]
```

### Output

Shows each room with:
- Name and capacity
- Price per hour (EUR)
- Token cost per hour
- Features and ideal uses

### Configuration

Rooms are defined in `src/settings/rooms.json`:

```json
{
  "rooms": [
    {
      "id": "satoshi",
      "name": "Satoshi Room",
      "slug": "satoshi",
      "capacity": 8,
      "pricePerHour": 25,
      "tokensPerHour": 2,
      "features": ["whiteboard", "screen", "video conferencing"],
      "idealFor": ["meetings", "workshops"],
      "googleCalendarId": "..."
    }
  ]
}
```

### Example

```bash
chb rooms
```
