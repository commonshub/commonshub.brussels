# Image Proxy Resizing And Cache

This document explains how image resizing works in the app, where resized files are cached, and how requests flow through the proxy layer.

## Overview

The app uses a single image proxy endpoint:

- `/api/image-proxy`

It can:

- read an original image from disk or fetch it remotely
- resize it on demand
- cache the resized result in a writable cache directory
- serve the cached resized file on subsequent requests

The resizing logic is shared in [src/lib/image-proxy-server.ts](../src/lib/image-proxy-server.ts).

## Size Buckets

The system uses four named size buckets:

- `xs`: 320px max width
- `sm`: 640px max width
- `md`: 1024px max width
- `lg`: 1920px max width

These are defined in `SIZE_CONFIG` in [src/lib/image-proxy-server.ts](../src/lib/image-proxy-server.ts).

## Request Flow

### 1. `next/image` asks for a width

Most UI images are rendered through `next/image`.

When `next/image` renders a proxy URL such as `/api/image-proxy?...`, the custom loader in [src/lib/image-loader.ts](../src/lib/image-loader.ts) does not pass the raw `w=` width through unchanged. Instead it maps the requested width to one of the proxy size buckets:

- `<= 320` -> `xs`
- `<= 640` -> `sm`
- `<= 1024` -> `md`
- `> 1024` -> `lg`

So a request like:

```text
/api/image-proxy?url=https%3A%2F%2Fimages.lumacdn.com%2Fcover.jpg
```

can become:

```text
/api/image-proxy?url=https%3A%2F%2Fimages.lumacdn.com%2Fcover.jpg&size=sm
```

This is important because the proxy routes resize on `size=`, not on a raw width parameter.

### 2. Proxy route resolves `size`

The image proxy route calls `resolveRequestedImageSize()` from [src/lib/image-proxy-server.ts](../src/lib/image-proxy-server.ts).

That function resolves the final size using this order:

1. Use `size` directly if it is valid.
2. Otherwise, if `w` is present, convert it to `xs|sm|md|lg`.
3. Otherwise, do not resize.

This makes the routes compatible with both:

- explicit proxy calls such as `?size=sm`
- legacy or loader-generated calls that still include `?w=...`

### 3. Original image is loaded

The source image comes from one of two places:

- local file under `DATA_DIR` for `/data/...` paths
- remote fetch for allowed external domains

Discord images are expected to be served from local files already stored in `data/{year}/{month}/channels/discord/images/`.

### 4. Resize happens with Sharp

If a valid size bucket is resolved, `resizeAndCacheImage()` is called.

The current resize behavior is:

- library: `sharp`
- output format: JPEG
- quality: `85`
- fit mode: `inside`
- enlargement: disabled via `withoutEnlargement: true`

That means:

- aspect ratio is preserved
- the image is constrained by max width
- smaller images are not upscaled

### 5. Resized file is cached on disk

Resized images are cached in the first writable directory from this list:

```text
IMAGE_PROXY_CACHE_DIR
DATA_DIR/tmp/
/tmp/commonshub-image-proxy/
```

If `DATA_DIR/tmp/` is read-only in production, the proxy falls back automatically to `/tmp/commonshub-image-proxy/`. If no writable cache directory is available, the proxy still resizes and serves the image but skips disk caching.

The filename format is:

```text
{imageId}-{size}.jpg
```

Examples:

```text
data/tmp/1435913431117987910-sm.jpg
data/tmp/523cf9fe7b2bcc01f6e01c516fe59f4e-lg.jpg
```

## Cache Keys

The cache key depends on the image source.

### Local files

For local files served through `/api/image-proxy`, the cache key is the basename of the original file without its extension.

Example:

```text
/data/2026/04/channels/discord/images/1435913431117987910.jpg
```

becomes:

```text
1435913431117987910-sm.jpg
```

### External URLs

For remote images served through `/api/image-proxy`, the cache key is an MD5 hash of the full source URL.

This avoids path collisions and keeps filenames safe for disk storage.

## Cache Reuse

Before resizing, `resizeAndCacheImage()` checks whether the cached file already exists.

If it does:

- the cached file is read from disk
- Sharp is skipped entirely
- the cached JPEG is returned immediately

If it does not:

- the original image is read or fetched
- Sharp generates the resized JPEG
- the resized JPEG is written to the selected writable cache directory
- that new file is returned

## HTTP Caching Behavior

The proxy routes also set HTTP cache headers on responses.

### Development

On localhost or when `NODE_ENV !== "production"`:

```text
Cache-Control: no-store, max-age=0
```

This avoids stale assets during development.

### Production

In production:

- remote proxied images use `CACHE_DURATION`
- local files use `CACHE_DURATION * 7`

`CACHE_DURATION` is currently 30 days.

That means:

- external proxied images are cached for 30 days
- local images served from disk are cached for 210 days

The resized file on disk in the selected writable cache directory is separate from these HTTP cache headers. Disk cache prevents repeated resizing on the server side, while HTTP caching reduces repeated network requests from browsers and CDNs.

## What Is Not Cached Here

This document is only about resized derivatives stored in the proxy cache directory.

It is separate from:

- original Discord images stored under `data/{year}/{month}/channels/discord/images/`
- message JSON caches
- other API-level in-memory caches

## Current Limitations

The current implementation is intentionally simple:

- cached resized files do not have a cleanup job
- resized variants are always written as JPEG, even if the source was PNG or WebP
- cache invalidation is filename-based, not content-hash-based

If an original image changes while keeping the same cache key, the resized cached file may need to be deleted manually.

## Relevant Files

- [src/lib/image-loader.ts](../src/lib/image-loader.ts)
- [src/lib/image-loader.mjs](../src/lib/image-loader.mjs)
- [src/lib/image-proxy-server.ts](../src/lib/image-proxy-server.ts)
- [src/app/api/image-proxy/route.ts](../src/app/api/image-proxy/route.ts)
- [tests/image-loader.test.ts](../tests/image-loader.test.ts)
- [tests/image-proxy.test.ts](../tests/image-proxy.test.ts)
