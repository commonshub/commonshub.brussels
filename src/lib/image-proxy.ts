/**
 * Shared utility for proxying image URLs through the image proxy API
 * This ensures consistent handling of local /data/ paths and external URLs
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.BASE_URL ||
  process.env.VERCEL_URL ||
  process.env.NEXT_PUBLIC_VERCEL_URL ||
  "http://localhost:3000";

export type ImageSize = "xs" | "sm" | "md" | "lg";

/**
 * Check if a URL is from the same host (local resource)
 */
function isLocalResource(url: string): boolean {
  if (url.startsWith('/')) return true; // Already relative
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(BASE_URL);
    return urlObj.hostname === baseUrlObj.hostname;
  } catch {
    return false;
  }
}

/**
 * Generate a proxied image URL using Discord message metadata (NEW API)
 *
 * @param channelId - Discord channel ID
 * @param messageId - Discord message ID
 * @param attachmentId - Discord attachment ID
 * @param timestamp - Message timestamp (Date object or ISO string)
 * @param size - Optional size parameter (xs|sm|md|lg) for image resizing
 * @param options - Optional configuration
 * @param options.relative - If true, returns relative URL (for static files). Default: false
 * @returns Proxied image URL
 */
export function getProxiedDiscordImage(
  channelId: string,
  messageId: string,
  attachmentId: string,
  timestamp: string | Date,
  size?: ImageSize,
  options?: { relative?: boolean }
): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;

  // Format as YYYYMMDD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const timestampStr = `${year}${month}${day}`;

  const params = new URLSearchParams({
    channelId,
    messageId,
    attachmentId,
    timestamp: timestampStr,
  });

  if (size) {
    params.set("size", size);
  }

  const path = `/api/discord-image-proxy?${params.toString()}`;

  // Return relative URL for static files, absolute for runtime
  return options?.relative ? path : `${BASE_URL}${path}`;
}

/**
 * Generate a proxied image URL from a full URL
 *
 * @param url - The image URL to proxy
 * @param size - Optional size parameter (xs|sm|md|lg) for image resizing
 * @param options - Optional configuration
 * @param options.relative - If true, returns relative URL when possible. Default: false
 * @returns Proxied image URL
 */
export function getProxiedImageUrl(
  url: string,
  size?: ImageSize,
  options?: { relative?: boolean }
): string {
  if (!url) return "";
  // Check if it's already a proxy URL (relative or absolute)
  if (url.includes("/api/image-proxy") || url.includes("/api/discord-image-proxy")) return url;

  // If it's a local resource and we want relative URLs, make it relative
  if (options?.relative && isLocalResource(url)) {
    try {
      const urlObj = new URL(url);
      url = urlObj.pathname + urlObj.search;
    } catch {
      // Already relative or invalid, use as-is
    }
  }

  // External URLs or local data paths need to be proxied
  const params = new URLSearchParams({
    url: url,
  });

  if (size) {
    params.set("size", size);
  }

  const path = `/api/image-proxy?${params.toString()}`;

  // Return relative URL for static files, absolute for runtime
  return options?.relative ? path : `${BASE_URL}${path}`;
}
