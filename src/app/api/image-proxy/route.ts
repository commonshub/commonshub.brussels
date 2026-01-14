import { type NextRequest, NextResponse } from "next/server";
import {
  fetchAndProcessExternalImage,
  type ImageSize,
} from "@/lib/image-proxy-server";

/**
 * Image Proxy API - Handles external image URLs
 * For Discord images, use /api/discord-image-proxy instead
 *
 * Query parameters:
 * - url: Image URL to proxy (required)
 * - size: Optional size parameter (xs|sm|md|lg) for resizing
 *
 * Example: /api/image-proxy?url=https://example.com/image.jpg&size=md
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const sizeParam = searchParams.get("size") as ImageSize | null;

  console.log("[image-proxy] Request - url:", url, "size:", sizeParam);

  if (!url) {
    return NextResponse.json(
      { error: "Missing required parameter: url" },
      { status: 400 }
    );
  }

  // Prevent recursive proxying - reject if URL is already a proxy URL
  if (url.includes("/api/image-proxy") || url.includes("/api/discord-image-proxy")) {
    console.log("[image-proxy] Rejected recursive proxy attempt:", url);
    return NextResponse.json(
      { error: "Cannot proxy a proxy URL" },
      { status: 400 }
    );
  }

  return fetchAndProcessExternalImage(url, sizeParam);
}
