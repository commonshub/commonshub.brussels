import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR, tierDir, tierFor } from "@/lib/data-paths";
import { isMember } from "@/lib/admin-check";
import { getLocalImagePath } from "@/lib/discord-cache";

interface ImageRecord {
  id?: string
  url: string
  /** Where chb saved the file, relative to DATA_DIR. */
  filePath?: string
  /** The Discord link the local copy replaced. */
  sourceUrl?: string
  timestamp?: string
  [key: string]: unknown
}

/**
 * Discord attachment links are signed and expire after a day, so a month-old
 * `url` is dead. chb downloads every attachment; point at that copy when it
 * is there (served through /api/image-proxy), and only fall back to Discord.
 */
export function withLocalImages<T extends { images?: ImageRecord[] }>(data: T, dataDir = DATA_DIR): Omit<T, "images"> & { images: ImageRecord[] } {
  const images = (data.images ?? []).map((image) => {
    const local =
      (image.filePath && fs.existsSync(path.join(dataDir, image.filePath)) ? `/data/${image.filePath}` : null) ??
      (image.id && image.timestamp ? getLocalImagePath(image.id, image.url, image.timestamp) : null)
    return local ? { ...image, url: local, sourceUrl: image.url } : image
  })
  return { ...data, images }
}


/**
 * GET /api/images                    → latest/<tier>/images.json
 * GET /api/images?year=YYYY&month=MM → YYYY/MM/<tier>/images.json
 */
// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  // The members tier carries the message text next to each photo; the
  // public one does not. One tier per viewer, never both.
  const tier = tierFor(await isMember());

  let filePath: string;
  if (year && month) {
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
    }
    filePath = path.join(tierDir(tier, year, month), "images.json");
  } else {
    filePath = path.join(tierDir(tier), "images.json");
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Images data not available" },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = withLocalImages(JSON.parse(content));
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("[api/images] read error:", error);
    return NextResponse.json(
      { error: "Failed to read images data" },
      { status: 500 }
    );
  }
}
