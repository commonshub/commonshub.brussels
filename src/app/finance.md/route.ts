import { NextResponse } from "next/server";
import { dataCacheHeaders } from "@/lib/data-route";
import { financeMarkdown } from "@/lib/opendata-markdown";

// Read the dataset at request time.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(financeMarkdown("https://commonshub.brussels"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", ...dataCacheHeaders(true) },
  });
}
