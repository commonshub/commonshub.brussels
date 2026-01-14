/**
 * Custom image loader for Next.js Image component
 * Handles image proxy URLs with query parameters
 *
 * Note: Next.js's `/_next/image` endpoint doesn't allow nested URLs (URLs that
 * point to other endpoints), so we can't route image proxy URLs through it.
 *
 * This loader adds width (w) and quality (q) parameters to image proxy URLs.
 * The image proxy uses these parameters to request appropriately-sized images
 * from Discord's CDN, which supports size parameters for optimization.
 */

export default function imageLoader({ src, width, quality }) {
  // If it's an image proxy URL, add width and quality parameters
  if (src.startsWith("/api/image-proxy") || src.startsWith("/api/discord-image-proxy")) {
    try {
      const url = new URL(src, "http://localhost");
      // Add width parameter (w)
      url.searchParams.set("w", width.toString());
      // Add quality parameter if provided (q)
      if (quality !== undefined) {
        url.searchParams.set("q", quality.toString());
      }
      // Return the pathname + search (without the origin)
      return `${url.pathname}${url.search}`;
    } catch (error) {
      // If URL parsing fails, return as-is
      console.error("Error parsing image proxy URL:", error);
      return src;
    }
  }

  // For static images from /images/ or other local paths,
  // add width parameter to satisfy Next.js loader requirements
  // Even though these won't be resized server-side, this prevents
  // the "loader does not implement width" warning
  if (src.startsWith("/")) {
    return `${src}?w=${width}${quality ? `&q=${quality}` : ""}`;
  }

  // For external URLs (https://...), return as-is
  // Next.js will handle optimization through remotePatterns
  return src;
}
