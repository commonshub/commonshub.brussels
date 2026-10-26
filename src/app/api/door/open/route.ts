import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { buildDoorLink } from "@/lib/door-link"
import { loadDoorVisitors } from "@/lib/door-today"
import { publicOrigin } from "@/lib/public-origin"

export const dynamic = "force-dynamic"

/**
 * POST (the dashboard's "Open the door"): a member's door link, valid for
 * the next 10 minutes. Members only, from the session. A POST, so another
 * site can't send a member's browser here (session cookies are SameSite=Lax).
 *
 * From the dashboard's button (Accept: application/json) the server follows
 * the link itself, so the member stays on the page, and answers with who came
 * to the hub today. Without JavaScript the form still works: a redirect to
 * the door (which opens it and says so in #door).
 */
export async function POST(request: Request) {
  const json = request.headers.get("accept")?.includes("application/json")
  const session = await auth()
  if (!session?.user || !(await isMember())) {
    return json ? NextResponse.json({ error: "Members only" }, { status: 403 }) : NextResponse.redirect(new URL("/", publicOrigin(request)), 303)
  }
  const now = new Date()
  const username = session.user.username || "A member"
  const url = await buildDoorLink({ name: username, host: "Commons Hub", reason: "Member (website)", start: new Date(now.getTime() - 60_000), end: new Date(now.getTime() + 10 * 60_000) })
  if (!url) return NextResponse.json({ error: "The door can't be opened from here right now" }, { status: 503 })
  if (!json) return NextResponse.redirect(url, 303)

  const opened = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
    .then((r) => r.ok)
    .catch(() => false)
  if (!opened) return NextResponse.json({ error: "The door didn't answer. Try again in a moment." }, { status: 502 })
  const { discordId, avatar } = session.user
  const me = { username, avatar: discordId && avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=96` : null }
  return NextResponse.json({ ok: true, visitors: await loadDoorVisitors(me) })
}
