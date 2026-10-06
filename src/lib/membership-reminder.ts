/**
 * When a membership stops being paid (a card payment failed, the
 * subscription was paused or it ended), the website emails the member once
 * with three ways to continue:
 *
 *   1. resume it or update the card (Stripe's customer portal),
 *   2. start a new monthly subscription,
 *   3. pay a year by bank transfer, with the structured communication that
 *      makes the transfer reconcile with their membership in Odoo.
 *
 * A paused membership keeps the member's access for 15 days at most (the
 * grace period); after that they are no longer counted as a member.
 *
 * The email links to /membership/renew?t=<token>: the token is signed by the
 * site (AUTH_SECRET) and carries who the member is, so the page can open
 * their Stripe portal and show their own bank communication.
 */

import { createHmac, timingSafeEqual } from "crypto"

import { BANK_DETAILS, formatIban } from "./bank-details"
import { partnerCommunication } from "./structured-communication"

export const GRACE_DAYS = 15
export const MONTHLY_LINK = "https://buy.stripe.com/00g9C7dFH8EI07eaEJ"
export const YEARLY_AMOUNT = { individual: 100, organisation: 200 }

const HUB = {
  name: "Commons Hub Brussels",
  address: "Rue de la Madeleine 51, 1000 Brussels",
  website: "https://commonshub.brussels",
  logoUrl: "https://commonshub.brussels/brandkit/commonshub-logo-sticker.png",
  from: "Commons Hub Brussels <hello@commonshub.brussels>",
  replyTo: "hello@commonshub.brussels",
}

export type ReminderReason = "payment_failed" | "paused" | "ended"

export interface RenewClaim {
  /** Member's first name (or organisation name). */
  n: string
  /** Stripe customer id, when they paid by card. */
  c?: string
  /** Odoo partner id, for the bank communication. */
  p?: number
  /** Organisation membership. */
  o?: boolean
  /** Valid until (unix seconds). */
  x: number
}

function key(): string {
  const k = process.env.AUTH_SECRET
  if (!k) throw new Error("AUTH_SECRET is not set")
  return k
}

export function signRenew(claim: RenewClaim, k = key()): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url")
  return `${payload}.${createHmac("sha256", `renew:${k}`).update(payload).digest("base64url")}`
}

export function verifyRenew(token: string, now = Date.now(), k = key()): RenewClaim | null {
  const [payload, sig] = (token ?? "").split(".")
  if (!payload || !sig) return null
  const expected = Buffer.from(createHmac("sha256", `renew:${k}`).update(payload).digest("base64url"))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RenewClaim
    return claim.n && claim.x * 1000 > now ? claim : null
  } catch {
    return null
  }
}

/** What to put in the transfer's communication field. */
export function bankCommunication(claim: Pick<RenewClaim, "p" | "n">): string {
  return claim.p ? partnerCommunication(claim.p) : `Membership ${claim.n}`.slice(0, 140)
}

export interface MembershipReminder {
  name: string
  email: string
  reason: ReminderReason
  organisation?: boolean
  /** End of the grace period, for a paused or failed membership. */
  graceEndsAt?: Date
  renewUrl: string
  communication: string
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Brussels" })

export function buildReminderEmail(d: MembershipReminder): { subject: string; html: string; text: string } {
  const amount = d.organisation ? YEARLY_AMOUNT.organisation : YEARLY_AMOUNT.individual
  const subject =
    d.reason === "ended" ? "Your Commons Hub membership has ended" : d.reason === "paused" ? "Your Commons Hub membership is paused" : "We couldn't renew your Commons Hub membership"
  const opening =
    d.reason === "ended"
      ? "Your membership of the Commons Hub has ended. We'd love to keep you with us."
      : d.reason === "paused"
        ? "Your membership of the Commons Hub is paused."
        : "The last payment for your membership of the Commons Hub didn't go through."
  const grace = d.graceEndsAt ? `You remain a member until ${day(d.graceEndsAt)}. After that, you'll no longer have a member's access.` : ""
  const why = "Memberships are how we pay the rent and keep this common space open for everyone. Thank you for being part of it."
  const bank = [
    ["Beneficiary", BANK_DETAILS.beneficiary],
    ["IBAN", formatIban(BANK_DETAILS.iban)],
    ["BIC", BANK_DETAILS.bic],
    ["Amount", `€${amount}`],
    ["Communication", d.communication],
  ]

  const button = (href: string, label: string, primary = false) =>
    `<a href="${esc(href)}" style="display:inline-block;background:${primary ? "#FF4C02" : "#ffffff"};color:${primary ? "#ffffff" : "#001309"};border:2px solid ${primary ? "#FF4C02" : "#001309"};text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">${esc(label)}</a>`

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF4F2;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #eaded9">
<tr><td style="padding:28px 28px 8px"><a href="${HUB.website}"><img src="${HUB.logoUrl}" alt="${HUB.name}" width="120" style="display:block;width:120px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:8px 28px 32px">
  <h1 style="font-size:22px;line-height:1.3;margin:12px 0 8px">Hi ${esc(d.name)},</h1>
  <p style="margin:0 0 12px">${esc(opening)}${grace ? ` ${esc(grace)}` : ""}</p>
  <p style="margin:0 0 20px">${esc(why)}</p>

  <h2 style="font-size:17px;margin:24px 0 6px">1. Resume, or update your card</h2>
  <p style="margin:0 0 10px">Restart your subscription, change your card or switch plans in a minute.</p>
  <p style="margin:0">${button(d.renewUrl, "Renew my membership", true)}</p>

  <h2 style="font-size:17px;margin:28px 0 6px">2. Start a new monthly membership</h2>
  <p style="margin:0 0 10px">€10 a month, by card or Bancontact, cancel any time.</p>
  <p style="margin:0">${button(MONTHLY_LINK, "Become a member again")}</p>

  <h2 style="font-size:17px;margin:28px 0 6px">3. Pay a year by bank transfer</h2>
  <p style="margin:0 0 10px">€${amount} for a year${d.organisation ? " (organisation)" : ""}. Please use exactly this communication, so we can match your transfer to your membership:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="background:#FBF4F2;border-radius:10px;width:100%"><tr><td style="padding:14px 18px;font-size:15px">
    ${bank.map(([k, v]) => `<div><strong>${esc(k)}:</strong> <span style="font-family:ui-monospace,Menlo,monospace">${esc(v)}</span></div>`).join("\n    ")}
  </td></tr></table>

  <p style="margin:28px 0 0;font-size:15px">Questions, or would you rather stop? Just reply to this email.</p>
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">${HUB.name} · ${esc(HUB.address)} · <a href="${HUB.website}" style="color:#5d625e">commonshub.brussels</a></td></tr>
</table></td></tr></table>
</body></html>`

  const text = [
    `Hi ${d.name},`,
    "",
    `${opening}${grace ? ` ${grace}` : ""}`,
    "",
    why,
    "",
    "1. RESUME, OR UPDATE YOUR CARD",
    d.renewUrl,
    "",
    "2. START A NEW MONTHLY MEMBERSHIP (€10 a month)",
    MONTHLY_LINK,
    "",
    `3. PAY A YEAR BY BANK TRANSFER (€${amount})`,
    ...bank.map(([k, v]) => `${k}: ${v}`),
    "Please use exactly this communication, so we can match your transfer to your membership.",
    "",
    "Questions, or would you rather stop? Just reply to this email.",
    "",
    `${HUB.name} · ${HUB.address} · ${HUB.website}`,
  ].join("\n")
  return { subject, html, text }
}

export async function sendReminder(d: MembershipReminder): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY is not set")
  const { subject, html, text } = buildReminderEmail(d)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: HUB.from, to: [d.email], reply_to: [HUB.replyTo], subject, html, text }),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string }
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body).slice(0, 200)}`)
  return { id: body.id || "" }
}
