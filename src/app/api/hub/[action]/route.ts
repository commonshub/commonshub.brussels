import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { ALLOWED_FIELDS, callTokenBot, pickFields } from "@/lib/token-bot"

export const dynamic = "force-dynamic"

/**
 * POST /api/hub/{options,availability,cowork,guestpass,book}: the dashboard's
 * booking dialogs, passed on to the bot for the signed-in member (who they
 * are comes from the session, never from the request).
 */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (!(action in ALLOWED_FIELDS)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  const session = await auth()
  if (!session?.user?.discordId || !(await isMember())) return NextResponse.json({ ok: false, error: "Members only" }, { status: 403 })
  const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
  const answer = await callTokenBot(action as Parameters<typeof callTokenBot>[0], session.user.discordId, pickFields(action, body))
  return NextResponse.json(answer.body, { status: answer.status })
}
