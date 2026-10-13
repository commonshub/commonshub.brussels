import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

import { auth } from "@/auth"
import { claimMemberRole, verifyClaim } from "@/lib/membership-applications-store"
import { applicationForSession, paidMembershipSession } from "@/lib/membership-checkout"

export const dynamic = "force-dynamic"

/**
 * A new member logged in with Discord on /membership/welcome: give them the
 * member role. The membership comes from the Stripe checkout they were sent
 * back from (`session_id`) or the link in the onboarding email (`t`); the
 * Discord account from their session. Their OAuth token (guilds.join) lets
 * the bot add them to the server if they are not in it yet.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.discordId) return NextResponse.json({ error: "Log in with Discord first" }, { status: 401 })
  const body = ((await request.json().catch(() => ({}))) ?? {}) as { session_id?: unknown; t?: unknown }

  let id: string | null = null
  if (typeof body.t === "string") id = verifyClaim(body.t)
  else if (typeof body.session_id === "string") {
    const checkout = await paidMembershipSession(body.session_id)
    id = checkout ? await applicationForSession(checkout) : null
    if (checkout && !id) return NextResponse.json({ error: "We're still processing your payment. Try again in a minute." }, { status: 409 })
  }
  if (!id) return NextResponse.json({ error: "This link isn't valid. Use the link in your onboarding email, or reply to it." }, { status: 400 })

  const secureCookie = (request.headers.get("cookie") ?? "").includes("__Secure-authjs.session-token")
  const jwt = await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie }).catch(() => null)
  const result = await claimMemberRole(id, {
    discordId: session.user.discordId,
    name: session.user.name || session.user.username || "",
    accessToken: typeof jwt?.accessToken === "string" ? jwt.accessToken : undefined,
  })
  if (!result.ok) {
    if (result.status === 502) console.error("[membership] role not granted for application", id)
    return NextResponse.json({ error: result.error, relogin: result.relogin ?? false }, { status: result.status })
  }
  return NextResponse.json({ ok: true, already: result.already })
}
