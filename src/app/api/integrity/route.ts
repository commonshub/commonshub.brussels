import { NextResponse } from "next/server";
import { dataCacheHeaders } from "@/lib/data-route";
import { readIntegrityIndex } from "@/lib/integrity";

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic";

/** GET /api/integrity → latest/hashes.json: every month's hash, newest first. */
export async function GET() {
  const index = readIntegrityIndex();
  if (!index) {
    return NextResponse.json({ error: "No integrity manifests yet" }, { status: 404, headers: dataCacheHeaders(false) });
  }
  return NextResponse.json(index, { headers: dataCacheHeaders(true) });
}
