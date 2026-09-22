import { NextRequest, NextResponse } from "next/server";
import { isMember } from "@/lib/admin-check";
import { tierFor } from "@/lib/data-paths";
import { getAvailableMonths, photoAuthors, readGeneratedImages } from "@/lib/reports";

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ year: string }>;
}

/**
 * GET /api/reports/[year]/photos → every photo of the year, newest first,
 * from the viewer's tier (members also get the message text).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { year } = await context.params;
    if (!/^\d{4}$/.test(year)) {
      return NextResponse.json({ error: "Invalid year format" }, { status: 400 });
    }

    const months = getAvailableMonths(year);
    if (months.length === 0) {
      return NextResponse.json({ error: "No data available for this year" }, { status: 404 });
    }

    const tier = tierFor(await isMember());
    const photos = months
      .flatMap((month) => readGeneratedImages(year, month, tier))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return NextResponse.json(
      { year, photos, activeMembers: photoAuthors(photos) },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    );
  } catch (error) {
    console.error("Error generating yearly photo gallery:", error);
    return NextResponse.json({ error: "Failed to generate photo gallery" }, { status: 500 });
  }
}
