/**
 * Shared utility for proxying image URLs through the image proxy API.
 * This handles both local /data/ paths and allowed external URLs.
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
  if (url.includes("/api/image-proxy")) return url;

  if (isLocalResource(url)) {
    try {
      const urlObj = new URL(url);
      url = urlObj.pathname + urlObj.search;
    } catch {
      // Already relative or invalid, use as-is
    }
  }

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
