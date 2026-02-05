import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { discordGet } from "@/lib/discord";
import {
  resizeAndCacheImage,
  type ImageSize,
  SIZE_CONFIG,
  CACHE_DURATION,
} from "@/lib/image-proxy-server";

/**
 * Discord Image Proxy API - Handles Discord-specific image parameters
 *
 * Query parameters:
 * - channelId: Discord channel ID (required)
 * - messageId: Discord message ID (required)
 * - attachmentId: Discord attachment ID (required)
 * - timestamp: Message timestamp in YYYYMMDD format or "latest" (required)
 * - size: Optional size parameter (xs|sm|md|lg) for resizing
 *
 * Example: /api/discord-image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20231215&size=md
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const messageId = searchParams.get("messageId");
  const attachmentId = searchParams.get("attachmentId");
  const timestamp = searchParams.get("timestamp");
  const sizeParam = searchParams.get("size") as ImageSize | null;

  console.log(
    "[discord-image-proxy] Request - channelId:",
    channelId,
    "messageId:",
    messageId,
    "attachmentId:",
    attachmentId,
    "timestamp:",
    timestamp,
    "size:",
    sizeParam
  );

  if (!channelId || !messageId || !attachmentId || !timestamp) {
    return NextResponse.json(
      {
        error:
          "Missing required parameters: channelId, messageId, attachmentId, timestamp",
      },
      { status: 400 }
    );
  }

  try {
    const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));

    // Try to find the image file
    // We need to check for the file extension since we don't know it from the parameters
    const possibleExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    let localPath: string | null = null;
    let resolvedPath: string | null = null;

    // Check if this is a "latest" request
    if (timestamp.startsWith("latest")) {
      // Latest path: data/latest/channels/discord/images/{attachmentId}.{ext}
      for (const ext of possibleExtensions) {
        const testPath = path.join(
          dataDir,
          "latest",
          "channels",
          "discord",
          "images",
          `${attachmentId}${ext}`
        );
        if (fs.existsSync(testPath)) {
          localPath = testPath;
          resolvedPath = path.resolve(testPath);
          break;
        }
      }
    } else {
      // Extract year and month from timestamp (YYYYMMDD -> YYYY and MM)
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);

      // Dated path: data/{year}/{month}/channels/discord/images/{attachmentId}.{ext}
      for (const ext of possibleExtensions) {
        const testPath = path.join(
          dataDir,
          year,
          month,
          "channels",
          "discord",
          "images",
          `${attachmentId}${ext}`
        );
        if (fs.existsSync(testPath)) {
          localPath = testPath;
          resolvedPath = path.resolve(testPath);
          break;
        }
      }
    }

    // If local file found, serve it
    if (localPath && resolvedPath) {
      // Security check - ensure path is within data directory
      if (!resolvedPath.startsWith(dataDir)) {
        console.log(
          "[discord-image-proxy] Security: Path outside data directory:",
          resolvedPath
        );
        return NextResponse.json({ error: "Invalid path" }, { status: 403 });
      }

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

      console.log("[discord-image-proxy] Serving local Discord image:", resolvedPath);

      // Apply resizing if size parameter is provided
      if (sizeParam && SIZE_CONFIG[sizeParam]) {
        buffer = await resizeAndCacheImage(buffer, attachmentId, sizeParam);
        contentType = "image/jpeg"; // Resized images are always JPEG
      }

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${CACHE_DURATION * 7}, s-maxage=${CACHE_DURATION * 7}`, // 7 days for local files
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // If local file not found, fetch from Discord API
    console.log(
      "[discord-image-proxy] Local file not found, fetching from Discord API"
    );

    const messageResponse = await discordGet(
      `/channels/${channelId}/messages/${messageId}`
    );

    if (!messageResponse.ok) {
      console.log("[discord-image-proxy] Discord API fetch failed:", messageResponse.status);
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const message = await messageResponse.json();

    // Find the attachment by ID
    const attachment = message.attachments?.find(
      (att: any) => att.id === attachmentId
    );

    if (!attachment || !attachment.url) {
      console.log("[discord-image-proxy] Attachment not found in message");
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    console.log("[discord-image-proxy] Found attachment URL, fetching from Discord CDN");

    // Fetch the Discord image directly
    const imageResponse = await fetch(attachment.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CommonsHubBot/1.0)",
      },
    });

    if (!imageResponse.ok) {
      console.log("[discord-image-proxy] Failed to fetch Discord image, status:", imageResponse.status);
      return NextResponse.json(
        { error: "Failed to fetch Discord image" },
        { status: imageResponse.status }
      );
    }

    let buffer = Buffer.from(await imageResponse.arrayBuffer());
    let contentType = imageResponse.headers.get("content-type") || "image/jpeg";

    // Apply resizing if size parameter is provided, using attachmentId as cache key
    if (sizeParam && SIZE_CONFIG[sizeParam]) {
      buffer = await resizeAndCacheImage(buffer, attachmentId, sizeParam);
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
    console.error("[discord-image-proxy] Error processing image request:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
