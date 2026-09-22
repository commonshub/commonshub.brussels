import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { tierDir, tierFor } from "@/lib/data-paths";
import { isMember } from "@/lib/admin-check";
import { withLocalImages } from "@/lib/images-local";

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
