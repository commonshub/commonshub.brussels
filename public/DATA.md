# Commons Hub Brussels - Data API

This document describes the publicly available data files that can be fetched directly by LLMs and applications to get information about Commons Hub Brussels activities, contributors, transactions, and events.

## Base URL

```
https://commonshub.brussels
```

## Data Structure

All data is organized by year and month:

```
/data/{year}/{month}/{file}.json
```

Example: `/data/2026/01/contributors.json`

## Available Data Files

### Contributors

**URL**: `/data/{year}/{month}/contributors.json`

Monthly list of community contributors with their activity and token balances.

```json
{
  "year": "2026",
  "month": "01",
  "summary": {
    "totalContributors": 37,
    "contributorsWithAddress": 37,
    "contributorsWithTokens": 19,
    "totalTokensIn": 150,
    "totalTokensOut": 138.5,
    "totalMessages": 286
  },
  "contributors": [
    {
      "id": "discord_user_id",
      "profile": {
        "name": "Display Name",
        "username": "discord_username",
        "avatar_url": "https://cdn.discordapp.com/...",
        "roles": ["Member", "Admin", ...]
      },
      "tokens": {
        "in": 28,
        "out": 4
      },
      "discord": {
        "messages": 51,
        "mentions": 19
      },
      "address": "0x..." // Blockchain wallet address
    }
  ]
}
```

### Transactions

**URL**: `/data/{year}/{month}/transactions.json`

Monthly financial transactions (Stripe payments, blockchain transfers).

```json
{
  "month": "2026-01",
  "generatedAt": "2026-02-11T07:09:16.038Z",
  "transactions": [
    {
      "id": "stripe:txn_xxx",
      "provider": "stripe",
      "chain": null,
      "accountSlug": "stripe",
      "accountName": "💳 Stripe Account",
      "currency": "EUR",
      "amount": 1000,
      "normalizedAmount": 1000,
      "fee": 35,
      "type": "CREDIT",
      "counterparty": "...",
      "timestamp": 1769884038,
      "metadata": {
        "collective": "commonshub",
        "category": "rental",
        "description": "Room booking"
      }
    }
  ]
}
```

### Events

**URL**: `/data/{year}/{month}/events.json`

Monthly calendar events from Google Calendar and Luma.

```json
{
  "month": "2026-01",
  "generatedAt": "2026-02-11T07:10:41.448Z",
  "events": [
    {
      "id": "event_id",
      "name": "Event Name",
      "description": "Event description",
      "startAt": "2026-01-05T11:00:00.000Z",
      "endAt": "2026-01-05T12:00:00.000Z",
      "timezone": "Europe/Brussels",
      "location": "Commons Hub Brussels",
      "url": "https://lu.ma/...",
      "coverImage": "https://...",
      "source": "luma",
      "calendarSource": "luma-api",
      "metadata": {
        "attendance": 25
      }
    }
  ]
}
```

### Members (Paying Subscribers)

**URL**: `/data/{year}/{month}/members.json`

Monthly list of paying members with subscription details.

```json
{
  "year": "2026",
  "month": "01",
  "productId": "prod_xxx",
  "summary": {
    "totalMembers": 25,
    "activeMembers": 23,
    "monthlyMembers": 18,
    "yearlyMembers": 5,
    "mrr": { "value": 280, "decimals": 2, "currency": "EUR" }
  },
  "members": [
    {
      "id": "sub_xxx...",
      "accounts": {
        "emailHash": "sha256_hash",
        "discord": "username"
      },
      "firstName": "Xavier",
      "plan": "yearly",
      "amount": { "value": 100, "decimals": 2, "currency": "EUR" },
      "interval": "year",
      "status": "active",
      "latestPayment": {
        "date": "2026-01-15",
        "amount": { "value": 100, "decimals": 2, "currency": "EUR" },
        "status": "succeeded"
      },
      "createdAt": "2024-08-01"
    }
  ]
}
```

## Yearly Aggregations

### Yearly Images

**URL**: `/data/{year}/images.json`

Top photos from Discord for the entire year, ranked by reactions.

### Activity Grid

**URL**: `/data/{year}/activitygrid.json`

Monthly activity summary showing contributor and photo counts.

```json
{
  "years": [
    {
      "year": "2026",
      "months": [
        {
          "month": "01",
          "contributorCount": 37,
          "photoCount": 156
        }
      ]
    }
  ]
}
```

## API Endpoints

### Reports API

- `GET /api/reports/{year}` - Yearly summary report
- `GET /api/reports/{year}/{month}` - Monthly detailed report
- `GET /api/reports/{year}/photos` - Top photos for the year
- `GET /api/reports/{year}/{month}/photos` - Photos for a specific month

### Members API

- `GET /api/members` - Current month members
- `GET /api/members?year=2026&month=01` - Specific month members

### Other APIs

- `GET /api/stats` - Discord community stats
- `GET /api/room-events?room={slug}` - Room booking calendar

## Available Years/Months

Data is available from June 2024 (Commons Hub opening) to present:

- 2024: 06-12
- 2025: 01-12
- 2026: 01-present

## LLM-Friendly Pages

These pages are optimized for LLM consumption:

- `/llms.txt` - Overview and instructions for LLMs
- `/about.md` - About Commons Hub in markdown
- `/events.md` - Upcoming events in markdown
- `/rooms.md` - Room information in markdown
- `/sitemap.md` - Full sitemap in markdown
- `/DATA.md` - This document

## Example Queries

### Get current month's top contributors
```
GET /data/2026/02/contributors.json
```

### Get financial summary for a year
```
GET /api/reports/2025
```

### Get all events for January 2026
```
GET /data/2026/01/events.json
```

### Get paying members count
```
GET /api/members?year=2026&month=02
```

## Rate Limits

Please be respectful with request frequency. Data is updated:
- Contributors: Daily
- Transactions: Daily
- Events: Every 6 hours
- Members: Daily

## Contact

For questions about the data API:
- Email: hello@commonshub.brussels
- Discord: https://discord.commonshub.brussels
