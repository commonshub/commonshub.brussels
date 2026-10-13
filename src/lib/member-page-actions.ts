/**
 * What a member's page may do for the person looking at it
 * (lib/member-pages.ts): send something to Discord or to hello@, as that
 * person, only after they confirm it in a dialog the page can't draw on or
 * click (it is in our page, the page is in a cross-origin frame).
 *
 *   await chb.discord.send({ to: "author", content, fields })   DM to the page's author
 *   await chb.discord.send({ to: "channel", content, fields })  the channel the author chose at publish
 *   await chb.email.send({ subject, content, fields, replyTo })  hello@commonshub.brussels
 *
 * The site, not the page, writes who sent it and from which page; the
 * page's text is quoted under that line, mentions never ping, and every
 * viewer is rate-limited. Nothing is stored here: it goes to Discord or
 * the inbox. Pure and client-safe: the dialog shows exactly this.
 */

export type PageAction =
  | { kind: "discord"; to: "author" | "channel"; content: string; fields?: Array<[string, string]> }
  | { kind: "email"; subject: string; content: string; fields?: Array<[string, string]>; replyTo?: string }

export const ACTION_LIMITS = { content: 1500, subject: 120, fields: 20, key: 60, value: 500 }

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i

const clean = (s: unknown, max: number) =>
  typeof s === "string"
    ? s
        .replace(/\r\n?/g, "\n")
        // Control characters and bidi overrides: what you see is what is sent.
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f‪-‮⁦-⁩]/g, "")
        .trim()
        .slice(0, max)
    : ""

/** Read what the page asked for; throws a message for the page when it is not acceptable. */
export function parseAction(kind: unknown, raw: unknown): PageAction {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const content = clean(r.content, ACTION_LIMITS.content)
  let fields: Array<[string, string]> | undefined
  if (r.fields !== undefined) {
    const entries = Array.isArray(r.fields) ? r.fields : r.fields && typeof r.fields === "object" ? Object.entries(r.fields) : null
    if (!entries) throw new Error("fields must be an object or [key, value] pairs")
    fields = entries
      .slice(0, ACTION_LIMITS.fields)
      .map((e) => (Array.isArray(e) ? e : []) as unknown[])
      .map(([k, v]) => [clean(String(k ?? ""), ACTION_LIMITS.key), clean(typeof v === "string" ? v : JSON.stringify(v ?? ""), ACTION_LIMITS.value)] as [string, string])
      .filter(([k, v]) => k && v)
  }
  if (!content && !fields?.length) throw new Error("Nothing to send: give content or fields")

  if (kind === "discord") {
    const to = r.to === "channel" ? "channel" : r.to === "author" || r.to === undefined ? "author" : null
    if (!to) throw new Error('to must be "author" or "channel"')
    return { kind, to, content, ...(fields?.length ? { fields } : {}) }
  }
  if (kind === "email") {
    const subject = clean(r.subject, ACTION_LIMITS.subject).replace(/\n/g, " ")
    if (!subject) throw new Error("subject is required")
    const replyTo = clean(r.replyTo, 200)
    if (replyTo && !EMAIL_RE.test(replyTo)) throw new Error("replyTo is not an email address")
    return { kind, subject, content, ...(fields?.length ? { fields } : {}), ...(replyTo ? { replyTo } : {}) }
  }
  throw new Error("Unknown action")
}

export interface ActionContext {
  pageTitle: string
  pageUrl: string
  author: string
  /** The Discord username of the person sending, signed in. */
  sender: string
}

const quote = (text: string) =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")

/** The Discord message: our line saying who and from where, then their text, quoted. */
export function discordText(a: Extract<PageAction, { kind: "discord" }>, ctx: ActionContext): string {
  const lines = [`📝 **@${ctx.sender}** via [${ctx.pageTitle.replace(/[[\]]/g, "")}](<${ctx.pageUrl}>):`]
  if (a.content) lines.push(quote(a.content))
  for (const [k, v] of a.fields ?? []) lines.push(quote(`**${k}**: ${v}`))
  return lines.join("\n").slice(0, 2000)
}

/** The email's text, from the site to hello@. */
export function emailText(a: Extract<PageAction, { kind: "email" }>, ctx: ActionContext): { subject: string; text: string } {
  const lines = [`Sent by @${ctx.sender} (Discord) from ${ctx.pageTitle}, a page by @${ctx.author}:`, ctx.pageUrl, ""]
  if (a.content) lines.push(a.content, "")
  for (const [k, v] of a.fields ?? []) lines.push(`${k}: ${v}`)
  if (a.replyTo) lines.push("", `Reply goes to: ${a.replyTo} (as they typed it)`)
  return { subject: `[${ctx.pageTitle.slice(0, 60)}] ${a.subject}`, text: lines.join("\n").trim() }
}

/** In-memory sliding windows: a few sends per page per person, and a ceiling per person. */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(private rules: Array<{ max: number; windowMs: number }>) {}
  take(keys: string[], now = Date.now()): boolean {
    for (const [i, key] of keys.entries()) {
      const rule = this.rules[i]
      const recent = (this.hits.get(key) ?? []).filter((t) => now - t < rule.windowMs)
      if (recent.length >= rule.max) return false
      this.hits.set(key, recent)
    }
    for (const key of keys) this.hits.get(key)!.push(now)
    return true
  }
}

// ── may the author post in that channel? ─────────────────────────────────

const B = (n: number) => BigInt(2 ** n)
const ZERO = BigInt(0)
const ALL = ~ZERO
const VIEW = B(10)
const SEND = B(11)
const SEND_IN_THREADS = B(38)
const ADMIN = B(3)

export interface Overwrite {
  id: string
  type: 0 | 1
  allow: string
  deny: string
}

/** Discord's permission computation for one member in one channel (guild base, then @everyone, roles, member overwrites). */
export function channelPermissions(input: {
  guildId: string
  ownerId?: string
  userId: string
  memberRoles: string[]
  roles: Array<{ id: string; permissions: string }>
  overwrites: Overwrite[]
}): bigint {
  if (input.ownerId === input.userId) return ALL
  const byId = new Map(input.roles.map((r) => [r.id, BigInt(r.permissions)]))
  let perms = byId.get(input.guildId) ?? ZERO
  for (const id of input.memberRoles) perms |= byId.get(id) ?? ZERO
  if (perms & ADMIN) return ALL
  const ow = new Map(input.overwrites.map((o) => [o.id, o]))
  const everyone = ow.get(input.guildId)
  if (everyone) perms = (perms & ~BigInt(everyone.deny)) | BigInt(everyone.allow)
  let allow = ZERO
  let deny = ZERO
  for (const id of input.memberRoles) {
    const o = ow.get(id)
    if (o && o.type === 0) {
      allow |= BigInt(o.allow)
      deny |= BigInt(o.deny)
    }
  }
  perms = (perms & ~deny) | allow
  const mine = ow.get(input.userId)
  if (mine && mine.type === 1) perms = (perms & ~BigInt(mine.deny)) | BigInt(mine.allow)
  return perms
}

export const canPost = (perms: bigint, thread: boolean) => (perms & VIEW) === VIEW && (perms & (thread ? SEND_IN_THREADS : SEND)) !== ZERO
