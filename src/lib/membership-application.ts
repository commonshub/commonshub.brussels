/**
 * Membership applications, from /membership to a paying member:
 *
 *   1. someone applies on /membership: they get an email (cc hello@) saying
 *      the application is pending and that they are welcome at the Friday
 *      potluck meanwhile;
 *   2. members with tokens vouch for them on /members/pending (a Nostr
 *      comment signed with the member's own key, see buildVouch);
 *   3. at three vouchers the application is approved: an email lists who
 *      vouched and gives the payment link;
 *   4. once they pay, the welcome (onboarding) email follows
 *      (lib/membership-welcome.ts), sent from the Stripe webhook.
 *
 * Pure: the shapes, the checks and the emails. The store (encrypted on the
 * community relays) is lib/membership-applications-store.ts.
 */

import { buildComment, type Community, type MemberLink, type SignedLike, type Template } from "./nostr-conventions"

export const VOUCHES_NEEDED = 3
/** Reacting with this on the application's post in #membership is a vouch. */
export const VOUCH_EMOJI = "✅"
export const PAYMENT_LINK = "https://buy.stripe.com/00g9C7dFH8EI07eaEJ"
/** That payment link's id in Stripe: its checkouts are memberships. */
export const PAYMENT_LINK_ID = "plink_1PjHtRFAhaWeDyow3NXAwNW0"
export const SITE = "https://commonshub.brussels"
export const POTLUCK_URL = `${SITE}/potluck`
export const PENDING_URL = `${SITE}/members/pending`
export const HELLO = "hello@commonshub.brussels"

export type MemberType = "individual" | "community" | "organisation"
export type ApplicationStatus = "pending" | "approved" | "member"

export interface Application {
  id: string
  submittedAt: string
  type: MemberType
  name: string
  email: string
  website?: string
  people?: string
  needs: string[]
  contribute?: string
  heardFrom?: string
  whoYouKnow?: string
  /** Members they know, picked from the community's Discord (pinged in #membership). */
  knows?: Array<{ discordId: string; name: string }>
  notes?: string
  /** Their Discord account, once they logged in after paying (and got the member role). */
  discordId?: string
  /** The post in #membership (members vouch there by reacting with VOUCH_EMOJI). */
  discordMessageId?: string
  /** Its channel: #membership; posts from before it had one are in #requests. */
  discordChannelId?: string
  /** How the application started: the form, or a payment without one. */
  source?: "form" | "payment"
  status: ApplicationStatus
  /** Who vouched, when approved (names as on Discord). */
  vouchers?: Array<{ discordId: string; name: string }>
  approvedAt?: string
  paidAt?: string
}

/** What members see on /members/pending: everything but the email address. */
export type PublicApplication = Omit<Application, "email">
export const withoutEmail = ({ email: _email, ...rest }: Application): PublicApplication => rest

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "")
export const isEmail = (s: string) => s.length <= 200 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i.test(s)

/** An application from the form, checked; or an error to show. */
// ── spam ────────────────────────────────────────────────────────────────────

/** Faster than anyone fills in the form. */
export const MIN_FILL_MS = 3000

/**
 * A name like "nntmgkmPCwTxURdm": one long word of letters, capitals in
 * the middle, and either a long run of consonants or hardly any vowels.
 * "TheCommonsHub", "ImpactHubBXL" or "Schwarzschild" stay people.
 */
export function isGibberishName(name: string): boolean {
  const s = name.trim()
  if (s.length < 10 || !/^[a-z]+$/i.test(s)) return false
  if ((s.slice(1).match(/[A-Z]/g) ?? []).length < 2 || !/[a-z]/.test(s)) return false
  const vowels = (s.match(/[aeiouy]/gi) ?? []).length
  const longestConsonants = Math.max(0, ...(s.match(/[^aeiouy]+/gi) ?? []).map((r) => r.length))
  return longestConsonants >= 5 || vowels / s.length < 0.2
}

/**
 * Why a submission looks like a bot, or null: the hidden "homepage" field
 * filled in (people never see it), sent within MIN_FILL_MS of the form
 * appearing (or without saying when, as a script posting straight here
 * does), or a gibberish name. The route answers bots as if all went well.
 */
export function spamReason(body: Record<string, unknown>): string | null {
  if (typeof body.homepage === "string" && body.homepage.trim()) return "trap field filled"
  const elapsed = typeof body.elapsedMs === "number" ? body.elapsedMs : NaN
  if (!(elapsed >= MIN_FILL_MS)) return Number.isFinite(elapsed) ? `sent after ${Math.round(elapsed)}ms` : "no fill time"
  if (typeof body.name === "string" && isGibberishName(body.name)) return "gibberish name"
  return null
}

export function parseApplication(body: Record<string, unknown>, id: string, now = new Date()): Application | { error: string } {
  const type: MemberType = body.type === "community" || body.type === "organisation" ? body.type : "individual"
  const name = text(body.name, 120).replace(/[\n<>]/g, " ")
  const email = text(body.email, 200).toLowerCase()
  if (!name) return { error: "Please tell us your name" }
  if (!isEmail(email)) return { error: "Please enter a valid email address" }
  const needs = Array.isArray(body.needs) ? body.needs.map((n) => text(n, 120)).filter(Boolean).slice(0, 12) : []
  const optional = (k: string, max = 2000) => text(body[k], max) || undefined
  const knows = (Array.isArray(body.knows) ? body.knows : [])
    .map((k) => (k && typeof k === "object" ? (k as Record<string, unknown>) : {}))
    .filter((k) => typeof k.id === "string" && /^\d{5,25}$/.test(k.id))
    .map((k) => ({ discordId: k.id as string, name: text(k.name, 80).replace(/[\n<>@]/g, "") || "a member" }))
    .filter((k, i, all) => all.findIndex((x) => x.discordId === k.discordId) === i)
    .slice(0, 10)
  return {
    id,
    submittedAt: now.toISOString(),
    type,
    name,
    email,
    ...(type !== "individual" ? { website: optional("website", 300), people: optional("people", 20) } : {}),
    needs,
    contribute: optional("contribute"),
    heardFrom: optional("heardFrom", 1000),
    whoYouKnow: optional("whoYouKnow", 1000),
    ...(knows.length ? { knows } : {}),
    notes: optional("notes"),
    status: "pending",
    source: "form",
  }
}

// ── vouching ────────────────────────────────────────────────────────────────

const VOUCH_LINE = /\n\n\*\*Vouched \(\d+ of \d+\):\*\*[^\n]*$/

/**
 * The application's post in #membership, with a last line saying who vouched
 * so far, however they did it (a ✅ there or the button on the website):
 * the two are the same vouch, and both show on Discord. Without vouchers the
 * line goes away.
 */
export function withVouchLine(content: string, vouchers: Array<{ discordId: string }>, needed = VOUCHES_NEEDED): string {
  const line = vouchers.length ? `\n\n**Vouched (${vouchers.length} of ${needed}):** ${vouchers.map((v) => `<@${v.discordId}>`).join(" ")}` : ""
  const base = content.replace(VOUCH_LINE, "")
  return base.slice(0, 2000 - line.length) + line
}

/** What a vouch is about: the application, as a NIP-73 web id. */
export const applicationUri = (id: string) => `${PENDING_URL}#${id}`

/**
 * A vouch: a NIP-22 comment on the application, tagged `vouch`, signed by the
 * member's own key, or by the site on behalf of a member who reacted on
 * Discord (`onBehalf`: their Discord id and name, tagged `on-behalf`).
 */
export function buildVouch(id: string, name: string, community: Community, sitePubkey: string, now = new Date(), onBehalf?: { discordId: string; name: string }): Template {
  const comment = buildComment(applicationUri(id), "web", `${onBehalf ? `${onBehalf.name} vouches` : "I vouch"} for ${name}.`, community, sitePubkey, now)
  return {
    ...comment,
    tags: [...comment.tags, ["t", "vouch"], ...(onBehalf ? [["discord", onBehalf.discordId], ["name", onBehalf.name], ["t", "on-behalf"], ["via", "discord-reaction"]] : [])],
  }
}

const tagOf = (e: SignedLike, name: string) => e.tags.find((t) => t[0] === name)?.[1]

/**
 * Who vouched for an application: one per Discord member (their keys are
 * attested by the site), oldest first, only members who hold tokens.
 */
export function vouchersOf(events: SignedLike[], id: string, links: MemberLink[], hasTokens: (discordId: string) => boolean, sitePubkey?: string): Array<{ discordId: string; name: string; at: string }> {
  const byKey = new Map<string, MemberLink>()
  for (const l of links) for (const k of l.keys) byKey.set(k, l)
  // A vouch the site signed for a member who reacted on Discord names them in its tags.
  const onBehalf = (e: SignedLike): MemberLink | undefined => {
    const discordId = e.pubkey === sitePubkey ? tagOf(e, "discord") : undefined
    return discordId ? { discordId, name: tagOf(e, "name"), keys: [], roles: [] } : undefined
  }
  const out = new Map<string, { discordId: string; name: string; at: string }>()
  for (const e of [...events].sort((a, b) => a.created_at - b.created_at)) {
    if (tagOf(e, "I") !== applicationUri(id) || !e.tags.some((t) => t[0] === "t" && t[1] === "vouch")) continue
    const link = onBehalf(e) ?? byKey.get(e.pubkey)
    if (!link || out.has(link.discordId) || !hasTokens(link.discordId)) continue
    out.set(link.discordId, { discordId: link.discordId, name: link.name || "A member", at: new Date(e.created_at * 1000).toISOString() })
  }
  return [...out.values()]
}

// ── emails ──────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const LOGO = `${SITE}/brandkit/commonshub-logo-sticker.png`
const ADDRESS = "Rue de la Madeleine 51, 1000 Brussels"
const firstName = (a: Pick<Application, "name" | "type">) => (a.type === "individual" ? a.name.split(" ")[0] : a.name)

/** A block of the email: a paragraph, a heading, a list, or a button. */
type Block = { p: string } | { h: string } | { ul: string[] } | { button: string; href: string } | { link: string; href: string; before?: string }

function render(subject: string, blocks: Block[]): { subject: string; html: string; text: string } {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF4F2;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #eaded9">
<tr><td style="padding:28px 28px 8px"><a href="${SITE}"><img src="${LOGO}" alt="Commons Hub Brussels" width="120" style="display:block;width:120px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:8px 28px 32px">
${blocks
  .map((b) =>
    "h" in b
      ? `<h2 style="font-size:17px;margin:24px 0 6px">${esc(b.h)}</h2>`
      : "ul" in b
        ? `<ul style="margin:0 0 12px;padding-left:20px">${b.ul.map((li) => `<li style="margin:0 0 6px">${esc(li)}</li>`).join("")}</ul>`
        : "button" in b
          ? `<p style="margin:20px 0"><a href="${esc(b.href)}" style="display:inline-block;background:#b83500;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(b.button)}</a></p>`
          : "link" in b
            ? `<p style="margin:0 0 12px">${b.before ? `${esc(b.before)} ` : ""}<a href="${esc(b.href)}" style="color:#b83500">${esc(b.link)}</a></p>`
            : `<p style="margin:0 0 12px">${esc(b.p).replace(/\n/g, "<br>")}</p>`,
  )
  .join("\n")}
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">Commons Hub Brussels · ${esc(ADDRESS)} · <a href="${SITE}" style="color:#5d625e">commonshub.brussels</a></td></tr>
</table></td></tr></table>
</body></html>`
  const text = [
    ...blocks.flatMap((b) =>
      "h" in b ? ["", b.h.toUpperCase()] : "ul" in b ? b.ul.map((li) => `- ${li}`) : "button" in b ? [`${b.button}: ${b.href}`] : "link" in b ? [`${b.before ? `${b.before} ` : ""}${b.link}: ${b.href}`] : [b.p, ""],
    ),
    "",
    `Commons Hub Brussels · ${ADDRESS} · ${SITE}`,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
  return { subject, html, text }
}

/** Who they know at the hub: the members they picked, and any names typed. */
export const knownNames = (a: Pick<Application, "knows" | "whoYouKnow">) => [...(a.knows ?? []).map((k) => k.name), ...(a.whoYouKnow ? [a.whoYouKnow] : [])].join(", ")

/** The answers, as the applicant gave them, so they (and hello@, in cc) can read them back. */
function answers(a: Application): string[] {
  return [
    `Joining as: ${a.type}${a.type !== "individual" && a.people ? ` (${a.people} people)` : ""}`,
    ...(a.website ? [`Website: ${a.website}`] : []),
    ...(a.needs.length ? [`How the community can help: ${a.needs.join("; ")}`] : []),
    ...(a.contribute ? [`What you can contribute: ${a.contribute}`] : []),
    ...(a.heardFrom ? [`How you heard about us: ${a.heardFrom}`] : []),
    ...(knownNames(a) ? [`Who you know at the hub: ${knownNames(a)}`] : []),
    ...(a.notes ? [`Anything else: ${a.notes}`] : []),
  ]
}

/** Right after applying: received, pending, we'll get back to you; come to the potluck meanwhile. */
export function buildReceivedEmail(a: Application): { subject: string; html: string; text: string } {
  return render(`Your membership application to the Commons Hub: ${a.name}`, [
    { p: `Hi ${firstName(a)},` },
    { p: "Thank you for applying to become a member of the Commons Hub Brussels! We've received your application." },
    { p: "Your application is pending. Members of the community will review it, and we'll get back to you as soon as possible." },
    { h: "In the meantime, come and meet us" },
    { p: "You're always welcome at our community potluck, every Friday from 12:30 to 13:30 at the hub. Bring something to share (or just yourself) and meet the people who make the hub: it's the best way to get to know us, and for us to get to know you." },
    { button: "About the Friday potluck", href: POTLUCK_URL },
    { p: `The hub is at ${ADDRESS}.` },
    { h: "What you told us" },
    { ul: answers(a) },
    { p: "Anything to add or correct? Just reply to this email." },
    { p: "Warm regards,\nThe Commons Hub Brussels community" },
  ])
}

/** Approved: who vouched, the payment link, and what comes after paying. */
export function buildAcceptedEmail(a: Application, vouchers: Array<{ name: string }>, paymentUrl: string): { subject: string; html: string; text: string } {
  const names = vouchers.map((v) => v.name)
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "members of the community")
  return render(`You've been accepted at the Commons Hub, ${firstName(a)}!`, [
    { p: `Hi ${firstName(a)},` },
    { p: `Good news: your membership application has been accepted! ${list} vouched for you.` },
    { p: "The last step is your membership fee. It's how we pay the rent and keep this common space open for everyone." },
    { button: "Pay my membership", href: paymentUrl },
    { p: "As soon as you've paid, you'll receive the onboarding email: how to open the door, how to join the conversations on Discord, and your first steps in the community." },
    { p: "Questions? Just reply to this email. See you soon at the hub!" },
    { p: "The Commons Hub Brussels community" },
  ])
}

/** The payment link for an application: tied to it, with their email filled in. */
export const paymentUrlFor = (a: Pick<Application, "id" | "email">) =>
  `${PAYMENT_LINK}?client_reference_id=${encodeURIComponent(`application_${a.id}`)}&prefilled_email=${encodeURIComponent(a.email)}`

/** The application a Stripe checkout pays for, from its client_reference_id. */
export const applicationIdFromReference = (ref: string | null | undefined) => ref?.match(/^application_([\w-]{6,40})$/)?.[1] ?? null
