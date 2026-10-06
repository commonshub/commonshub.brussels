import { NextResponse } from "next/server"

import { isTokenBotConfigured, searchMembers, TokenBotError } from "@/lib/token-bot"

export const dynamic = "force-dynamic"

/**
 * Name autocomplete on the community tablet: Discord members of the
 * community matching what was typed (display names, public on /community
 * already). Answers only to a query of at least one character, a dozen at
 * most.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 50)
  if (!q) return NextResponse.json({ members: [] })
  if (!isTokenBotConfigured()) return NextResponse.json({ error: "Shift sign-ups are not available right now" }, { status: 503 })
  try {
    const members = await searchMembers(q, 12)
    return NextResponse.json({ members: members.map(({ id, displayName, username, avatar }) => ({ id, displayName: displayName || username, avatar: avatar ?? null })) })
  } catch (error) {
    const status = error instanceof TokenBotError ? error.status : 502
    return NextResponse.json({ error: "Could not search the community" }, { status: status >= 500 ? 502 : status })
  }
}
