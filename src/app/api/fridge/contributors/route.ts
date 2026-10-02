import { NextResponse } from "next/server"

import { loadCrateContributors } from "@/lib/fridge-contributors"

export const dynamic = "force-dynamic"

/** Names of the people who offered a crate and asked to be listed. */
export async function GET() {
  const contributors = await loadCrateContributors()
  return NextResponse.json({ contributors }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=600" } })
}
