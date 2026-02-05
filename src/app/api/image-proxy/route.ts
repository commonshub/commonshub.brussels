import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  fetchAndProcessExternalImage,
  resizeAndCacheImage,
  type ImageSize,
  SIZE_CONFIG,
  CACHE_DURATION,
} from "@/lib/image-proxy-server";

/**
 * Image Proxy API - Handles both local data paths and external image URLs
 *
 * Query parameters:
 * - url: Image URL or local path (e.g., /data/2025/11/channels/discord/images/123.jpg) (required)
 * - size: Optional size parameter (xs|sm|md|lg) for resizing
 *
 * Example: /api/image-proxy?url=/data/2025/11/channels/discord/images/123.jpg&size=sm
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

  // Check if this is a local data path
  if (url.startsWith("/data/")) {
    return handleLocalDataPath(url, sizeParam);
  }

  // Otherwise, handle as external URL
  return fetchAndProcessExternalImage(url, sizeParam);
}

/**
 * Handle local data directory paths
 */
async function handleLocalDataPath(
  localPath: string,
  sizeParam: ImageSize | null
): Promise<NextResponse> {
  try {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    // Remove leading /data/ and construct absolute path
    const relativePath = localPath.replace(/^\/data\//, "");
    const absolutePath = path.join(dataDir, relativePath);

    console.log("[image-proxy] Serving local file:", absolutePath);

    // Security check - ensure path is within data directory
    const resolvedDataDir = path.resolve(dataDir);
    const resolvedPath = path.resolve(absolutePath);
    if (!resolvedPath.startsWith(resolvedDataDir)) {
      console.log("[image-proxy] Security: Path outside data directory:", resolvedPath);
      console.log("[image-proxy] Expected to be within:", resolvedDataDir);
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.log("[image-proxy] File not found:", resolvedPath);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read the file
    let buffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    let contentType = contentTypeMap[ext] || "image/jpeg";

    // Apply resizing if size parameter is provided
    if (sizeParam && SIZE_CONFIG[sizeParam]) {
      // Use filename without extension as imageId
      const imageId = path.basename(resolvedPath, ext);
      buffer = await resizeAndCacheImage(buffer, imageId, sizeParam);
      contentType = "image/jpeg"; // Resized images are always JPEG
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION * 7}, s-maxage=${CACHE_DURATION * 7}`, // 7 days for local files
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[image-proxy] Error serving local file:", error);
    return NextResponse.json(
      { error: "Failed to serve local file" },
      { status: 500 }
    );
  }
}
