import { NextResponse } from "next/server";
import { dataCacheHeaders } from "@/lib/data-route";
import { readMonthIntegrity } from "@/lib/integrity";

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic";

/** GET /api/integrity/YYYY/MM → that month's manifest, as chb wrote it. */
export async function GET(_request: Request, { params }: { params: Promise<{ year: string; month: string }> }) {
  const { year, month } = await params;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }
  const manifest = readMonthIntegrity(year, month);
  if (!manifest) {
    return NextResponse.json({ error: "No integrity manifest for that month" }, { status: 404, headers: dataCacheHeaders(false) });
  }
  return NextResponse.json(manifest, { headers: dataCacheHeaders(true) });
}
