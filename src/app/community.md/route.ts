import { NextResponse } from "next/server";
import { dataCacheHeaders } from "@/lib/data-route";
import { communityMarkdown } from "@/lib/opendata-markdown";

// Read the dataset at request time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(communityMarkdown("https://commonshub.brussels"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", ...dataCacheHeaders(true) },
  });
}
