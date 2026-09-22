import { NextResponse } from "next/server";
import { readEventsForMonth } from "@/lib/dataset";

/**
 * GET /api/events/months/[year]/[month] → the month's public events, from
 * the public tier of the dataset (the year rollup filtered by month).
 */
// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year, month } = await params;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  try {
    const events = readEventsForMonth("public", year, month);
    if (events.length === 0) {
      return NextResponse.json({ error: "Events data not available for that month" }, { status: 404 });
    }
    return NextResponse.json(
      { year, month, count: events.length, events },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  } catch (error) {
    console.error(`[api/events/${year}/${month}] read error:`, error);
    return NextResponse.json({ error: "Failed to read events data" }, { status: 500 });
  }
}
