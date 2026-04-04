import fs from "fs";
import path from "path";
import sharp from "sharp";
import { DATA_DIR } from "./data-paths";
import { NextResponse } from "next/server";

// Cache images for 30 days
export const CACHE_DURATION = 60 * 60 * 24 * 30;

// Size configurations
export const SIZE_CONFIG = {
  xs: 320,
  sm: 640,
  md: 1024,
  lg: 1920,
} as const;

export type ImageSize = keyof typeof SIZE_CONFIG;

/**
 * Resize an image and cache it
 * @param sourceBuffer - Source image buffer
 * @param imageId - Unique identifier for the image (attachmentId or hash of URL)
 * @param size - Target size (xs, sm, md, lg)
 * @returns Buffer of resized image
 */
export async function resizeAndCacheImage(
  sourceBuffer: Buffer,
  imageId: string,
  size: ImageSize
): Promise<Buffer> {
  const tmpDir = path.join(DATA_DIR, "tmp");

  // Ensure tmp directory exists
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const cachedPath = path.join(tmpDir, `${imageId}-${size}.jpg`);

  // Check if cached version exists
  if (fs.existsSync(cachedPath)) {
    console.log(`[resize] Serving cached ${size} image:`, cachedPath);
    return fs.readFileSync(cachedPath);
  }

  // Resize the image
  const maxWidth = SIZE_CONFIG[size];
  console.log(`[resize] Resizing image to ${size} (maxWidth: ${maxWidth}px)`);

  const resizedBuffer = await sharp(sourceBuffer)
    .resize(maxWidth, undefined, {
      width: maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Cache the resized image
  fs.writeFileSync(cachedPath, resizedBuffer);
  console.log(`[resize] Cached ${size} image:`, cachedPath);

  return resizedBuffer;
}

/**
 * Fetch and process an external image
 * @param url - Image URL to fetch
 * @param sizeParam - Optional size parameter for resizing
 * @returns NextResponse with image data
 */
export async function fetchAndProcessExternalImage(
  url: string,
  sizeParam: ImageSize | null
): Promise<NextResponse> {
  // Allowed domains for external image proxying
  const allowedDomains = [
    "framerusercontent.com",
    "framer.com",
    "commonshub.brussels",
    "cdn.discordapp.com",
    "media.discordapp.net",
    "images.lumacdn.com",
    "lumacdn.com",
    "og.luma.com",
    "cdn.lu.ma",
    "lu.ma",
    "luma.com",
    "img.evbuc.com",
    "eventbrite.com",
    "cdn.evbuc.com",
    "evbuc.com",
    "secure.meetupstatic.com",
    "meetupstatic.com",
    "meetup.com",
    "images.unsplash.com",
    "unsplash.com",
    "pbs.twimg.com",
    "twimg.com",
    "twitter.com",
    "x.com",
    // Additional common image CDNs
    "res.cloudinary.com",
    "cloudinary.com",
    "imgix.net",
    "amazonaws.com",
    "googleusercontent.com",
    "storage.googleapis.com",
  ];

  try {
    const parsedUrl = new URL(url);

    const isAllowed = allowedDomains.some((domain) =>
      parsedUrl.hostname.endsWith(domain)
    );

    if (!isAllowed) {
      console.log("[image-proxy] Domain not allowed:", parsedUrl.hostname);
      return NextResponse.json(
        { error: "Domain not allowed" },
        { status: 403 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CommonsHubBot/1.0)",
      },
    });

    if (!response.ok) {
      console.log("[image-proxy] Failed to fetch image, status:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: response.status }
      );
    }

    let contentType = response.headers.get("content-type") || "image/png";
    let buffer = Buffer.from(await response.arrayBuffer());

    // Apply resizing if size parameter is provided
    if (sizeParam && SIZE_CONFIG[sizeParam]) {
      // Create a hash of the URL to use as imageId
      const crypto = require("crypto");
      const imageId = crypto.createHash("md5").update(url).digest("hex");
      buffer = await resizeAndCacheImage(buffer, imageId, sizeParam);
      contentType = "image/jpeg"; // Resized images are always JPEG
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[image-proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image" },
      { status: 500 }
    );
  }
}
