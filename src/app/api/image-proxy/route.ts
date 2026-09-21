import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import { isServableDataPath } from "@/lib/served-paths";
import {
  fetchAndProcessExternalImage,
  resizeAndCacheImage,
  type ImageSize,
  SIZE_CONFIG,
  CACHE_DURATION,
  resolveRequestedImageSize,
} from "@/lib/image-proxy-server";

function getCacheControl(request: NextRequest, localFile: boolean): string {
  const isLocalDev =
    process.env.NODE_ENV !== "production" ||
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";

  if (isLocalDev) return "no-store, max-age=0";

  const maxAge = localFile ? CACHE_DURATION * 7 : CACHE_DURATION;
  return `public, max-age=${maxAge}, s-maxage=${maxAge}`;
}

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/**
 * Image Proxy API - Handles both local data paths and external image URLs
 *
 * Query parameters:
 * - url: Image URL or local path (e.g., /data/2026/09/public/events/images/evt.png or /images/foo.jpg) (required)
 * - size: Optional size parameter (xs|sm|md|lg) for resizing
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const sizeParam = resolveRequestedImageSize(searchParams.get("size"), searchParams.get("w"));

  if (!url) {
    return NextResponse.json({ error: "Missing required parameter: url" }, { status: 400 });
  }

  // Prevent recursive proxying - reject if URL is already a proxy URL
  if (url.includes("/api/image-proxy")) {
    return NextResponse.json({ error: "Cannot proxy a proxy URL" }, { status: 400 });
  }

  if (url.startsWith("/data/")) {
    const relativePath = url.slice("/data/".length);
    if (!isServableDataPath(relativePath)) {
      return NextResponse.json({ error: "Not a served file" }, { status: 403 });
    }
    return handleLocalPath(request, relativePath, sizeParam, DATA_DIR);
  }

  if (url.startsWith("/images/")) {
    const relativePath = url.slice(1);
    if (!IMAGE_TYPES[path.extname(relativePath).toLowerCase()] || relativePath.split("/").some((p) => p === "" || p === "..")) {
      return NextResponse.json({ error: "Not a served file" }, { status: 403 });
    }
    return handleLocalPath(request, relativePath, sizeParam, path.join(process.cwd(), "public"));
  }

  // Otherwise, handle as external URL
  const response = await fetchAndProcessExternalImage(url, sizeParam);
  response.headers.set("Cache-Control", getCacheControl(request, false));
  return response;
}

/** Serve one image from under `rootDir`; the path must stay inside it. */
async function handleLocalPath(request: NextRequest, relativePath: string, sizeParam: ImageSize | null, rootDir: string): Promise<NextResponse> {
  try {
    const resolvedRootDir = path.resolve(rootDir);
    const resolvedPath = path.resolve(rootDir, relativePath);
    // Compare against root + separator: "/data-other/x" must not pass for root "/data".
    if (!resolvedPath.startsWith(resolvedRootDir + path.sep)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    let buffer: Buffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = IMAGE_TYPES[ext] || "image/jpeg";

    if (sizeParam && SIZE_CONFIG[sizeParam]) {
      const imageId = path.basename(resolvedPath, ext);
      buffer = await resizeAndCacheImage(buffer, imageId, sizeParam);
      contentType = "image/jpeg"; // Resized images are always JPEG
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": getCacheControl(request, true),
      },
    });
  } catch (error) {
    console.error("[image-proxy] Error serving local file:", error);
    return NextResponse.json({ error: "Failed to serve image" }, { status: 500 });
  }
}
