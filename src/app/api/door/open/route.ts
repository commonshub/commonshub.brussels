import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { buildDoorLink } from "@/lib/door-link"

export const dynamic = "force-dynamic"

/**
 * POST (the dashboard's "Open the door" form): a member's door link, valid
 * for the next 10 minutes, as a redirect to the door (which opens it and
 * says so in #door). Members only, from the session. A POST, so another site
 * can't send a member's browser here (session cookies are SameSite=Lax).
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || !(await isMember())) return NextResponse.redirect(new URL("/", request.url), 303)
  const now = new Date()
  const url = await buildDoorLink({ name: session.user.username || "A member", host: "Commons Hub", reason: "Member (website)", start: new Date(now.getTime() - 60_000), end: new Date(now.getTime() + 10 * 60_000) })
  if (!url) return NextResponse.json({ error: "The door can't be opened from here right now" }, { status: 503 })
  return NextResponse.redirect(url, 303)
}
