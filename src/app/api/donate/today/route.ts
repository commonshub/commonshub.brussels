import { NextResponse } from "next/server"

import { loadDonateToday } from "@/lib/donate-today"

export const dynamic = "force-dynamic"

/** What /donate/screen polls: today's payments to the hub, live (see lib/donate-today.ts). Names nobody. */
export async function GET() {
  return NextResponse.json(await loadDonateToday(), { headers: { "Cache-Control": "no-store" } })
}
