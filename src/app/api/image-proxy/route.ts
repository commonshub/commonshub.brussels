import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import { isServableDataPath } from "@/lib/served-paths";
import crypto from "crypto";
import { isPublicPhotoPath } from "@/lib/photos";
import {
  fetchAndProcessExternalImage,
  readCachedResize,
  resizeAndCacheImage,
  type ImageSize,
  SIZE_CONFIG,
  CACHE_DURATION,
  resolveRequestedImageSize,
} from "@/lib/image-proxy-server";

function getCacheControl(request: NextRequest, localFile: boolean, immutable = false): string {
  const isLocalDev =
    process.env.NODE_ENV !== "production" ||
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";

  if (isLocalDev) return "no-store, max-age=0";
  // A photo's public copy is named after its Discord attachment id: it never changes.
  if (immutable) return "public, max-age=31536000, s-maxage=31536000, immutable";

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

    const immutable = isPublicPhotoPath(relativePath);
    const headers = (contentType: string) => ({ "Content-Type": contentType, "Cache-Control": getCacheControl(request, true, immutable) });
    const ext = path.extname(resolvedPath).toLowerCase();

    if (sizeParam && SIZE_CONFIG[sizeParam]) {
      // Keyed on the path: a basename alone could collide across folders.
      const imageId = crypto.createHash("md5").update(`${rootDir}:${relativePath}`).digest("hex");
      const cached = readCachedResize(imageId, sizeParam);
      if (cached) return new NextResponse(new Uint8Array(cached), { headers: headers("image/jpeg") });
      const resized = await resizeAndCacheImage(fs.readFileSync(resolvedPath), imageId, sizeParam);
      return new NextResponse(new Uint8Array(resized), { headers: headers("image/jpeg") }); // resized images are JPEG
    }

    return new NextResponse(new Uint8Array(fs.readFileSync(resolvedPath)), { headers: headers(IMAGE_TYPES[ext] || "image/jpeg") });
  } catch (error) {
    console.error("[image-proxy] Error serving local file:", error);
    return NextResponse.json({ error: "Failed to serve image" }, { status: 500 });
  }
}
