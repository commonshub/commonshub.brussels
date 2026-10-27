/**
 * A member's month at the Commons Hub, at /<username>/<year>/<month> and in
 * the monthly email: the days they came (the door), the tokens they
 * received and spent and what for, the thank-yous they got in 💝praise, the
 * photos people shared in #contributions, and what's coming up.
 *
 * Read from chb's dataset, members tier (door.json names who opened the
 * door, so the page is for members only):
 *   YYYY/MM/members/door.json           days per opener
 *   YYYY/MM/members/transactions.json   the token's mints, burns and transfers (on chain)
 *   YYYY/MM/members/praise.json         💝praise
 *   YYYY/MM/members/contributions.json  #contributions, with photos
 *   latest/public/events.json           upcoming events
 * A member's token account is found from their Discord id
 * (getAccountAddressFromDiscordUserId).
 *
 * No email address is ever read here: the email is rendered for whoever
 * sends it (buildRecapEmail).
 */

import { readTierJson } from "./dataset"
import { normalizeContributor, type ContributorsFile } from "./contributors"
import { plainText, praiseText, clip, type ChannelFeed } from "./contributions-screen"
import { isPublicEvent, unwrapGoogleRedirect } from "./public-events"
import { photoSource } from "./photos"
import { getAccountAddressFromDiscordUserId } from "./citizenwallet"
import { getCachedWalletAddress, setCachedWalletAddress } from "./wallet-address-cache"

const TZ = "Europe/Brussels"
export const SITE = "https://commonshub.brussels"

export interface RecapMember {
  id: string
  username: string
  name: string
  avatar?: string | null
}

export interface TokenLine {
  /** Milliseconds. */
  at: number
  /** Always positive. */
  amount: number
  what: string
}

export interface RecapPraise {
  at: number
  from: { name: string; avatar?: string }
  text: string
}

export interface RecapPhoto {
  /** /data/YYYY/MM/public/images/… (or a URL), to go through the image proxy. */
  src: string
  by: string
  text: string
}

export interface RecapEvent {
  name: string
  /** ISO. */
  start: string
  url: string
}

export interface Recap {
  member: RecapMember
  year: string
  month: string
  /** Days they opened the door. */
  days: number
  received: TokenLine[]
  spent: TokenLine[]
  receivedTotal: number
  spentTotal: number
  praise: RecapPraise[]
  photos: RecapPhoto[]
  events: RecapEvent[]
}

export const MONTH_RE = /^\d{4}$/
export const isRecapPath = (year: string, month: string) => MONTH_RE.test(year) && /^(0[1-9]|1[0-2])$/.test(month)

/** "October 2026". */
export const monthName = (year: string, month: string, withYear = true) =>
  new Date(Date.UTC(Number(year), Number(month) - 1, 15)).toLocaleDateString("en-GB", { month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: TZ })

/** "12 Oct". */
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })

/** "3 tokens", "1.5 tokens", "1 token". */
export function tokens(n: number): string {
  const v = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
  return `${v} ${n === 1 ? "token" : "tokens"}`
}

// ── the door ────────────────────────────────────────────────────────────────

interface DoorFile {
  openers?: Array<{ id?: string; username?: string; name?: string; days?: number }>
}

/** Days they opened the door: their Discord entry, else the one under their name (links from events). */
export function doorDays(file: DoorFile | null, member: RecapMember): number {
  const openers = file?.openers ?? []
  const byId = openers.find((o) => o.id && o.id === member.id)
  if (byId) return byId.days ?? 0
  const names = [member.username, member.name].filter(Boolean).map((n) => n.toLowerCase())
  const byName = openers.find((o) => !o.id && names.includes((o.name ?? "").toLowerCase()))
  return byName?.days ?? 0
}

// ── tokens ──────────────────────────────────────────────────────────────────

interface TokenTx {
  accountId: string
  currency?: string
  type: string
  amount: number
  timestamp: number
  metadata?: { description?: string; note?: string; t?: string }
}

const FALLBACK: Record<string, string> = {
  shift: "Caretaking shift",
  mint: "Contribution",
}

/**
 * What a token movement was for, as a member reads it: "Issued 3 CHT to leen
 * for a 3h shift on …" → "For a 3h shift on …"; the attendees of a meeting
 * and the guest a pass was for are left out.
 */
export function tokenReason(tx: Pick<TokenTx, "type" | "metadata">): string {
  const meta = tx.metadata ?? {}
  let text = (meta.description || meta.note || "").replace(/\s+/g, " ").trim()
  text = text.replace(/^Issued [\d.]+ \w+ to \S+ /i, "")
  if (/attendance/i.test(text)) text = text.replace(/:.*$/, "")
  if (/^(guest pass|coworking)/i.test(text)) text = text.replace(/:.*$/, "").replace(/ for \S+$/, "")
  text = text.replace(/ (room) room /i, " $1 ")
  if (text) return text.charAt(0).toUpperCase() + text.slice(1)
  if (tx.type === "DEBIT") return "Sent to another member"
  if (tx.type === "CREDIT") return "From another member"
  return FALLBACK[meta.t ?? ""] ?? (tx.type === "BURN" ? "Spent (no reason given)" : "Issued (no reason given)")
}

/** Their token movements in the month: mints and transfers in are received; burns and transfers out are spent. */
export function tokenLines(txs: TokenTx[], address: string | null): { received: TokenLine[]; spent: TokenLine[] } {
  const received: TokenLine[] = []
  const spent: TokenLine[] = []
  if (!address) return { received, spent }
  const me = address.toLowerCase()
  for (const tx of txs) {
    if (tx.currency !== "CHT" || !tx.accountId.toLowerCase().endsWith(me) || !tx.amount) continue
    const line = { at: tx.timestamp * 1000, amount: Math.abs(tx.amount), what: tokenReason(tx) }
    ;(tx.amount > 0 ? received : spent).push(line)
  }
  const byDate = (a: TokenLine, b: TokenLine) => a.at - b.at
  return { received: received.sort(byDate), spent: spent.sort(byDate) }
}

const sum = (lines: TokenLine[]) => Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100

// ── praise and photos ───────────────────────────────────────────────────────

const nameOf = (p?: { displayName?: string | null; username?: string | null } | null) => (p?.displayName || p?.username || "").trim()

/** Thank-yous that mention them, oldest first. */
export function praiseFor(feed: ChannelFeed | null, member: RecapMember): RecapPraise[] {
  return (feed?.messages ?? [])
    .filter((m) => m.author?.id !== member.id && (m.mentions ?? []).some((p) => p.id === member.id))
    .map((m) => ({
      at: Date.parse(m.timestamp),
      from: { name: nameOf(m.author) || "Someone", ...(m.author?.avatarUrl ? { avatar: m.author.avatarUrl } : {}) },
      text: praiseText(m.content, (m.mentions ?? []).map(nameOf), 280),
    }))
    .filter((p) => Number.isFinite(p.at) && p.text)
    .sort((a, b) => a.at - b.at)
}

/** Every photo shared in #contributions that month, theirs first. */
export function contributionPhotos(feed: ChannelFeed | null, member: RecapMember, limit = 24): RecapPhoto[] {
  const messages = [...(feed?.messages ?? [])].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  const mine = (m: (typeof messages)[number]) => (m.author?.id === member.id ? 0 : 1)
  return messages
    .sort((a, b) => mine(a) - mine(b))
    .flatMap((m) => (m.images ?? []).map((img) => ({ src: photoSource({ url: img, filePath: img }), by: nameOf(m.author), text: clip(plainText(m.content).replace(/@(\S)/g, "$1"), 90) })))
    .filter((p) => p.src.startsWith("/data/"))
    .slice(0, limit)
}

// ── upcoming events ─────────────────────────────────────────────────────────

interface EventsFile {
  events?: Array<{ name?: string; title?: string; startAt?: string; start_at?: string; url?: string | null }>
}

export function upcomingEvents(file: EventsFile | null, now = new Date(), limit = 4): RecapEvent[] {
  return (file?.events ?? [])
    .map((e) => ({ name: (e.name || e.title || "").trim(), start: e.startAt || e.start_at || "", url: unwrapGoogleRedirect(e.url || ""), raw: e }))
    .filter((e) => e.name && e.start && Date.parse(e.start) >= now.getTime() && isPublicEvent(e.raw))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, limit)
    .map(({ name, start, url }) => ({ name, start, url: url || `${SITE}/events` }))
}

// ── loading ─────────────────────────────────────────────────────────────────

/** A member by their Discord username (the community's contributors list). */
export function findMember(username: string): RecapMember | null {
  const file = readTierJson<ContributorsFile>("public", "contributors.json")
  const wanted = username.toLowerCase()
  for (const raw of file?.contributors ?? []) {
    const c = normalizeContributor(raw)
    if (c.username?.toLowerCase() === wanted) return { id: String(c.id), username: c.username, name: c.displayName || c.username, avatar: c.avatar }
  }
  return null
}

export function buildRecap(
  member: RecapMember,
  year: string,
  month: string,
  files: { door: DoorFile | null; transactions: { transactions?: TokenTx[] } | null; praise: ChannelFeed | null; contributions: ChannelFeed | null; events: EventsFile | null },
  address: string | null,
  now = new Date(),
): Recap {
  const { received, spent } = tokenLines(files.transactions?.transactions ?? [], address)
  return {
    member,
    year,
    month,
    days: doorDays(files.door, member),
    received,
    spent,
    receivedTotal: sum(received),
    spentTotal: sum(spent),
    praise: praiseFor(files.praise, member),
    photos: contributionPhotos(files.contributions, member),
    events: upcomingEvents(files.events, now),
  }
}

export async function loadRecap(username: string, year: string, month: string, now = new Date()): Promise<Recap | null> {
  if (!isRecapPath(year, month)) return null
  const member = findMember(username)
  if (!member) return null
  let address = getCachedWalletAddress(member.id)
  if (!address) {
    address = await getAccountAddressFromDiscordUserId(member.id).catch(() => null)
    if (address) setCachedWalletAddress(member.id, address)
  }
  const read = <T,>(file: string) => readTierJson<T>("members", file, year, month)
  return buildRecap(
    member,
    year,
    month,
    {
      door: read("door.json"),
      transactions: read("transactions.json"),
      praise: read("praise.json"),
      contributions: read("contributions.json"),
      events: readTierJson<EventsFile>("public", "events.json"),
    },
    address ?? null,
    now,
  )
}
