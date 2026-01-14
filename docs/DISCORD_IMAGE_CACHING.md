# Discord Image Caching System

This document describes the Discord image caching system that stores Discord images locally to avoid expired CDN URLs.

## Overview

Discord CDN URLs contain authentication tokens that expire after 24 hours. To avoid broken images, we:
1. Download images when caching Discord messages
2. Store them locally in `data/{year}/{month}/discord/images/`
3. Serve them via the image proxy API
4. Use local images when available in the UI

## Components

### 1. Discord Cache Warmup Script

**File:** `scripts/warmup-discord-cache.js`

**Usage:**
```bash
# Normal mode (fetch new messages only)
npx tsx scripts/warmup-discord-cache.js

# Force rewrite mode (re-fetch all messages and images)
npx tsx scripts/warmup-discord-cache.js --force
# or
npx tsx scripts/warmup-discord-cache.js -f
```

**Features:**
- Downloads images using `proxy_url` (preferred) or `url` from Discord API
- Stores images with attachment ID as filename: `{attachmentId}.{ext}`
- Organizes by year/month: `data/2025/11/discord/images/`
- Checks for missing images and re-fetches with fresh URLs
- `--force` flag re-fetches all messages regardless of cache

**Key Functions:**
- `downloadImage(url, attachmentId, year, month)` - Downloads single image using `url` field
- `downloadAttachmentImages(attachments, year, month)` - Processes all attachments using direct `url`
- `refetchAndDownloadImagesForMonth(channelId, monthKey, cachedMessages)` - Re-fetches with fresh URLs
- `hasImagesForMonth(year, month)` - Checks if images exist locally
- `fetchChannelHistory(channelId, channelName, forceRewrite)` - Main fetch function

**File Storage:**
- Messages: `data/{year}/{month}/discord/{channelId}/messages.json`
- Images: `data/{year}/{month}/discord/images/{attachmentId}.{ext}`

**Note:** Uses Discord's `url` field directly, not `proxy_url`.

### 2. Image Proxy API

**File:** `app/api/image-proxy/route.ts`

**Features:**
- Serves local Discord images from `/data/` paths
- Security check: ensures paths are within data directory
- Proxies external URLs (Discord CDN, etc.)
- 7-day cache for local files, 24-hour cache for proxied URLs

**URL Format:**
```javascript
// Local image
/api/image-proxy?url=/data/2025/11/discord/images/1234567890.jpg

// External URL
/api/image-proxy?url=https://cdn.discordapp.com/...
```

### 3. Discord Cache Utility

**File:** `lib/discord-cache.ts`

**Key Function:**
```typescript
getLocalImagePath(attachmentId: string, url: string, timestamp: string): string | null
```

Returns local path if image exists, null otherwise.

**Example:**
```typescript
const localPath = getLocalImagePath(
  "1234567890",
  "https://cdn.discordapp.com/...",
  "2025-11-15T10:30:00Z"
);
// Returns: "/data/2025/11/discord/images/1234567890.jpg"
```

### 4. Image Lightbox Component

**File:** `components/image-lightbox.tsx`

**Updated Features:**
- Accepts `attachmentId` in image props
- Checks for local images using `getLocalImagePath()`
- Falls back to Discord CDN if local image not found
- Uses local images for both thumbnails and fullscreen

**Image Props:**
```typescript
{
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  author?: { ... };
  messageId?: string;
  channelId?: string;
  reactions?: Array<...>;
  timestamp?: string;
  attachmentId?: string;  // NEW
}
```

### 5. Discord Image Gallery

**File:** `components/discord-image-gallery.tsx`

**Updated Features:**
- `ImagePost` interface includes `attachmentId`
- Passes `attachmentId` to lightbox
- Automatically uses local images when available

## File Structure

```
data/
├── 2025/
│   ├── 11/
│   │   └── discord/
│   │       ├── images/
│   │       │   ├── 1443604936028852376.jpeg
│   │       │   ├── 1443604937094463558.jpeg
│   │       │   └── ...
│   │       ├── images.json  (monthly images with reactions)
│   │       ├── 1280532849287495726/
│   │       │   └── messages.json  (channel messages cache)
│   │       └── 1297965144579637248/
│   │           └── messages.json
│   └── 12/
│       └── discord/
│           ├── images/
│           │   └── ...
│           ├── images.json
│           └── [channelId]/
│               └── messages.json
├── latest/
│   └── discord/
│       ├── images.json  (latest images from most recent month)
│       └── [channelId]/
│           └── images.json  (latest images per channel)
```

## Testing

**Test File:** `tests/discord-image-cache.test.ts`

```bash
# Run tests
npm test tests/discord-image-cache.test.ts
```

**Test Coverage:**
- ✅ Fetches messages from last week (7 days)
- ✅ Downloads and caches images from recent messages
- ✅ Writes and reads cache correctly
- ✅ Handles missing local images gracefully
- ✅ Organizes images by month correctly

**Test Behavior:**
- Tests use 1-week window instead of full month for faster execution
- Gracefully skips when Discord token is not available
- Tests both cache functionality and Discord API integration
- Verifies local image path resolution

## Workflow

### Initial Setup (Warm Cache)
```bash
npx tsx scripts/warmup-discord-cache.js
```

This will:
1. Fetch all historic messages from Discord
2. Download images with fresh URLs
3. Store in month-organized directories
4. Cache messages in JSON files

### Force Refresh
```bash
npx tsx scripts/warmup-discord-cache.js --force
```

This will:
1. Ignore existing cache
2. Re-fetch all messages
3. Re-download all images with fresh URLs
4. Overwrite existing cache files

### Incremental Updates

Run the warmup script periodically (e.g., daily):
```bash
npx tsx scripts/warmup-discord-cache.js
```

It will:
1. Check for new messages
2. Download new images
3. Check for missing images in existing months
4. Re-fetch and download if needed

## Important Notes

### URL Expiration
- Discord CDN URLs expire after ~24 hours
- Uses direct `url` field from Discord API (not `proxy_url`)
- Always download images immediately when fetching messages
- Never rely on cached URLs from old messages

### Query Parameters
- Keep full URLs including query parameters (contain auth tokens)
- Don't strip `?ex=...&is=...&hm=...` parameters
- These are required for successful downloads

### Image Naming
- Uses attachment ID from Discord: `{attachmentId}.{ext}`
- Extension from original URL: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Consistent naming across cache and downloads
- No need to modify cached JSON structure

### Security
- Image proxy validates paths are within `data/` directory
- No path traversal vulnerabilities
- Only serves files from allowed directories

## API Integration

### Discord Contributors API

**File:** `app/api/discord/contributors/route.ts`

When providing image data, include `attachmentId`:

```typescript
{
  imageUrl: attachment.url,
  attachmentId: attachment.id,  // Include this
  timestamp: message.timestamp,
  // ... other fields
}
```

### Static Images Files

Images are now served from static JSON files generated at build time:

**Generated by:** `scripts/generate-data-files.ts`

**File locations:**
- `/data/latest/discord/{channelId}/images.json` - Latest images per channel
- `/data/{year}/{month}/discord/images.json` - Monthly images with reactions
- `/data/{year}/{month}/discord/{channelId}/messages.json` - Cached channel messages

**Components using static files:**
- `components/room-image-gallery.tsx` - Fetches from `/data/latest/discord/{channelId}/images.json`
- `components/community-activity-gallery.tsx` - Same approach

## Troubleshooting

### Images not loading
1. Check if images exist locally:
   ```bash
   ls -la data/2025/11/discord/images/
   ```

2. Re-run warmup with force:
   ```bash
   npx tsx scripts/warmup-discord-cache.js --force
   ```

3. Check console for 404 errors
4. Verify Discord bot token is valid

### Cache issues
1. Delete specific month cache:
   ```bash
   rm -rf data/2025/11/discord/
   ```

2. Re-run warmup:
   ```bash
   npx tsx scripts/warmup-discord-cache.js
   ```

### Permissions
Ensure Discord bot has:
- `Read Message History` permission
- Access to all channels you want to cache

## Performance

### Storage
- Images are ~500KB-3MB each
- Organized by month for easy cleanup
- Old months can be archived/deleted

### Bandwidth
- Initial warmup downloads all images
- Incremental updates only fetch new images
- Local serving reduces Discord CDN load

### Caching
- Local images cached for 7 days (browser)
- External URLs cached for 24 hours
- Image proxy handles all caching headers
