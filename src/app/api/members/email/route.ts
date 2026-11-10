import { NextResponse } from "next/server"
import { Resend } from "resend"

import { auth } from "@/auth"
import { isMember } from "@/lib/admin-check"
import { recordLoginLink } from "@/lib/discord-links"
import { ACTIVATION_ERRORS, activateMembership, paysMembership } from "@/lib/member-activation"
import { fromSite } from "@/lib/email-address"
import { issueLinkCode, verifyLinkCode } from "@/lib/member-link-code"
import { isEmail } from "@/lib/membership-application"
import { memberIdForEmail } from "@/lib/membership"
import { planFor } from "@/lib/member-plan"
import { chbPubkey, codeSecret, normalizeEmail, sendToChb } from "@/lib/partner-email"

export const dynamic = "force-dynamic"

/**
 * POST /api/members/email { email } mails a code to the address;
 * POST /api/members/email { email, code } checks it and hands the address to
 * chb for the member's Odoo partner (lib/partner-email.ts), and links it to
 * their Discord account (lib/discord-links.ts): someone who pays with
 * another address than their Discord one finds their plan. Who they are
 * comes from the session.
 *
 * Signed in without the member role (lib/member-activation.ts): a code is
 * only mailed to an address that pays a current membership (the answer is
 * the same either way), and confirming it gives them the role. Nothing goes
 * to chb's partner then: the membership already has that address.
 */

/** Codes mailed per member, per process: a few an hour at most. */
const sent = new Map<string, number[]>()
const MAX_PER_HOUR = 3

export async function POST(request: Request) {
  const session = await auth()
  const discordId = session?.user?.discordId
  if (!discordId) return NextResponse.json({ ok: false, error: "Log in with Discord first" }, { status: 401 })
  const member = await isMember()
  const secret = codeSecret()
  if (!secret || !chbPubkey()) return NextResponse.json({ ok: false, error: "Not available yet" }, { status: 503 })

  const body = ((await request.json().catch(() => ({}))) ?? {}) as { email?: unknown; code?: unknown }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : ""
  if (!isEmail(email)) return NextResponse.json({ ok: false, error: "That doesn't look like an email address" }, { status: 400 })
  const account = `discord:user:${discordId}`
  const target = `email:${email}`

  if (typeof body.code !== "string") {
    const now = Date.now()
    const recent = (sent.get(discordId) ?? []).filter((t) => now - t < 3_600_000)
    if (recent.length >= MAX_PER_HOUR) return NextResponse.json({ ok: false, error: "Too many codes: try again in an hour" }, { status: 429 })
    sent.set(discordId, [...recent, now])
    if (!member && !paysMembership(memberIdForEmail(email))) return NextResponse.json({ ok: true, sent: true })
    const code = issueLinkCode(account, target, now, secret)!
    try {
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: fromSite(),
        to: [email],
        subject: `Your Commons Hub code: ${code}`,
        text: [
          `@${session.user.username} asked to add this address to their Commons Hub membership.`,
          ``,
          `Your code is ${code}. It is valid for about fifteen minutes.`,
          ``,
          `If that wasn't you, ignore this email: nothing has been changed.`,
        ].join("\n"),
      })
    } catch (error) {
      console.error("[partner-email] could not send the code:", error)
      return NextResponse.json({ ok: false, error: "Could not send the code, please try again" }, { status: 502 })
    }
    return NextResponse.json({ ok: true, sent: true })
  }

  if (!verifyLinkCode(account, target, body.code, Date.now(), secret)) return NextResponse.json({ ok: false, error: "That code didn't match, or it has expired" }, { status: 400 })
  if (!member) {
    const result = await activateMembership({ discordId, accessToken: session.user.accessToken }, memberIdForEmail(email), "email")
    if (result.ok) return NextResponse.json({ ok: true, saved: true, member: true })
    const { error, status } = ACTIVATION_ERRORS[result.reason]
    return NextResponse.json({ ok: false, error }, { status })
  }
  try {
    await sendToChb(discordId, email)
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save" }, { status: 502 })
  }
  const emailHash = memberIdForEmail(email)
  await recordLoginLink(discordId, emailHash, new Date(), "email")
  // Whether it's the address of a membership: the dashboard then shows their plan.
  return NextResponse.json({ ok: true, saved: true, member: !!planFor({}, undefined, emailHash ? [emailHash] : []) })
}
