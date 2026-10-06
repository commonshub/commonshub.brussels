import { NextResponse } from "next/server"

import settings from "@/settings/settings.json"
import { isDiscordConfigured, searchGuildMembers } from "@/lib/discord"

export const dynamic = "force-dynamic"

/**
 * Name autocomplete on the community tablet: members of the community's
 * Discord whose name starts with what was typed (Discord's member search;
 * display names are public on /community already). A dozen at most.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 50)
  if (!q || q.includes("@")) return NextResponse.json({ members: [] })
  if (!isDiscordConfigured()) return NextResponse.json({ error: "Discord is not available right now" }, { status: 503 })
  try {
    const members = await searchGuildMembers(settings.discord.guildId, q, 12)
    return NextResponse.json({ members: members.map(({ id, displayName, avatar }) => ({ id, displayName, avatar })) })
  } catch (error) {
    console.error("[tablet] member search failed:", error)
    return NextResponse.json({ error: "Could not search the community" }, { status: 502 })
  }
}
