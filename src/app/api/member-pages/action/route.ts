import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { parseAction } from "@/lib/member-page-actions"
import { ActionError, runPageAction } from "@/lib/member-page-actions-server"
import { getPage } from "@/lib/member-pages"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * A member's page sends something as the signed-in viewer, after they
 * confirmed it in our dialog (components/member-page/member-page-frame.tsx).
 * Called by our page only: the sandboxed page can't reach /api (CSP), and a
 * request from another site carries no session (SameSite) and fails the
 * origin check.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!origin || !host || new URL(origin).host !== host.split(",")[0]) return error("Forbidden", 403)

  const session = await auth()
  const user = session?.user as { discordId?: string; username?: string } | undefined
  if (!user?.discordId || !user.username) return error("Log in with Discord to send this", 401)

  const body = (await request.json().catch(() => ({}))) as { username?: string; slug?: string; kind?: string; data?: unknown }
  const page = getPage(String(body.username ?? "").toLowerCase(), String(body.slug ?? ""))
  if (!page) return error("No such page", 404)
  if (page.visibility !== "public" && !(await isMember())) return error("This page is for members", 403)

  let action
  try {
    action = parseAction(body.kind, body.data)
  } catch (e) {
    return error(e instanceof Error ? e.message : "Invalid", 400)
  }
  try {
    const result = await runPageAction(page, action, { discordId: user.discordId, username: user.username }, `https://commonshub.brussels/members/${page.username}/${page.slug}`)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof ActionError) return error(e.message, e.message.startsWith("Too many") ? 429 : 400)
    console.error("[member-pages] action failed:", e)
    return error("Sending failed", 500)
  }
}

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status })
