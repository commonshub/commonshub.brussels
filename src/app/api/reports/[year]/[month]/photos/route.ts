import { NextRequest, NextResponse } from "next/server";
import { isMember } from "@/lib/admin-check";
import { tierFor } from "@/lib/data-paths";
import { photoAuthors, readGeneratedImages } from "@/lib/reports";

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ year: string; month: string }>;
}

/**
 * GET /api/reports/[year]/[month]/photos → the month's photos, newest first,
 * from the viewer's tier (members also get the message text).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { year, month } = await context.params;
    if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: "Invalid year or month format" }, { status: 400 });
    }

    const tier = tierFor(await isMember());
    const photos = readGeneratedImages(year, month, tier).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return NextResponse.json(
      { year, month, photos, activeMembers: photoAuthors(photos) },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch (error) {
    console.error("Error generating monthly photo gallery:", error);
    return NextResponse.json({ error: "Failed to generate photo gallery" }, { status: 500 });
  }
}
