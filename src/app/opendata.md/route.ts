import { NextResponse } from "next/server";
import { opendataSkill } from "@/lib/opendata-skill";

// The skill embeds the data-quality section, generated from the dataset.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The open-data skill as markdown, for agents (also at /opendata/SKILL.md; /opendata is the HTML view). */
export async function GET() {
  return new NextResponse(opendataSkill("https://commonshub.brussels"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
