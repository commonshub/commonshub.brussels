import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getSettings, saveSettings, verifySettingsLink } from "@/lib/notification-settings"

export const dynamic = "force-dynamic"

/**
 * GET/POST /api/notifications: a member's recap email settings. Who they are
 * comes from the signed link in the email (?t= or body.t), else from the
 * session; never from a Discord id in the request.
 */
async function whoAmI(token: string | null | undefined): Promise<string | null> {
  if (token) return verifySettingsLink(token)?.d ?? null
  const session = await auth()
  return session?.user?.discordId ?? null
}

export async function GET(request: Request) {
  const id = await whoAmI(new URL(request.url).searchParams.get("t"))
  if (!id) return NextResponse.json({ ok: false, error: "This link has expired: log in to change your settings" }, { status: 401 })
  const { monthly, quarterly, yearly } = await getSettings(id)
  return NextResponse.json({ ok: true, settings: { monthly, quarterly, yearly } })
}

export async function POST(request: Request) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
  const id = await whoAmI(typeof body.t === "string" ? body.t : null)
  if (!id) return NextResponse.json({ ok: false, error: "This link has expired: log in to change your settings" }, { status: 401 })
  const saved = await saveSettings(id, { monthly: body.monthly === true, quarterly: body.quarterly === true, yearly: body.yearly === true }).catch((error: Error) => error)
  if (saved instanceof Error) return NextResponse.json({ ok: false, error: saved.message }, { status: 502 })
  return NextResponse.json({ ok: true, settings: { monthly: saved.monthly, quarterly: saved.quarterly, yearly: saved.yearly } })
}
