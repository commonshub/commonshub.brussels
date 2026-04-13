import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const requestedPath = pathSegments.join("/");

    // Security: Block access to private paths
    if (requestedPath.includes("/private/")) {
      return NextResponse.json(
        { error: "Access to private data is not allowed" },
        { status: 403 }
      );
    }

    // Construct the full file path
    const filePath = path.join(DATA_DIR, requestedPath);

    // Security: Ensure the resolved path is within DATA_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedDataDir = path.resolve(DATA_DIR);
    if (!resolvedPath.startsWith(resolvedDataDir)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Check if it's a directory (not allowed)
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      return NextResponse.json(
        { error: "Directory listing not allowed" },
        { status: 403 }
      );
    }

    // Read the file
    const fileContent = fs.readFileSync(filePath);

    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".json": "application/json",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".txt": "text/plain",
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
    };
    const contentType = contentTypeMap[ext] || "application/octet-stream";
    const isLocalDev =
      process.env.NODE_ENV !== "production" ||
      request.nextUrl.hostname === "localhost" ||
      request.nextUrl.hostname === "127.0.0.1";
    const cacheControl = isLocalDev
      ? "no-store, max-age=0"
      : "public, max-age=3600";

    // Return the file with appropriate headers
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    console.error("Error serving data file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
