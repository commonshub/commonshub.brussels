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
 * Generate a proxied image URL using Discord message metadata (NEW API)
 *
 * @param channelId - Discord channel ID
 * @param messageId - Discord message ID
 * @param attachmentId - Discord attachment ID
 * @param timestamp - Message timestamp (Date object or ISO string)
 * @param size - Optional size parameter (xs|sm|md|lg) for image resizing
 * @returns Proxied image URL
 */
export function getProxiedDiscordImage(
  channelId: string,
  messageId: string,
  attachmentId: string,
  timestamp: string | Date,
  size?: ImageSize
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

  return `${BASE_URL}/api/discord-image-proxy?${params.toString()}`;
}

/**
 * Generate a proxied image URL from a full URL
 *
 * @param url - The image URL to proxy
 * @param size - Optional size parameter (xs|sm|md|lg) for image resizing
 * @returns Proxied image URL
 */
export function getProxiedImageUrl(url: string, size?: ImageSize): string {
  if (!url) return "";
  // Check if it's already a proxy URL (relative or absolute)
  if (url.includes("/api/image-proxy") || url.includes("/api/discord-image-proxy")) return url;
  // External URLs need to be proxied

  const params = new URLSearchParams({
    url: url,
  });

  if (size) {
    params.set("size", size);
  }

  return `${BASE_URL}/api/image-proxy?${params.toString()}`;
}
