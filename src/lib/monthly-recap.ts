/**
 * A member's month (or quarter, or year) at the Commons Hub, at
 * /<username>/<year>/<month>, /<username>/<year>/Q<n> and /<username>/<year>,
 * and in the recap emails: the days they came (the door), the tokens they
 * received and spent and what for (and to or from whom), the thank-yous they
 * got in 💝praise, the photos people shared in #contributions, and what's
 * coming up.
 *
 * Read from chb's dataset, members tier (door.json names who opened the
 * door, so the page is for members only), month by month:
 *   YYYY/MM/members/door.json           days per opener
 *   YYYY/MM/members/transactions.json   the token's mints, burns and transfers (on chain);
 *                                       a transfer is one DEBIT row on the sender's account
 *   YYYY/MM/members/tokens-issued.json  who received mints (Discord ids and names)
 *   YYYY/MM/members/praise.json         💝praise
 *   YYYY/MM/members/contributions.json  #contributions, with photos
 *   latest/public/events.json           upcoming events
 * Token accounts follow from Discord ids (citizenwallet getCardAddresses).
 * What a transfer was for is the note token-bot's /send publishes on Nostr
 * (kind 1111, t=send), matched by amount and time: it is keyed by the user
 * operation's hash, not the transaction's.
 *
 * No email address is ever read here: the email is rendered for whoever
 * sends it (lib/monthly-recap-email.ts).
 */

import { readTierJson } from "./dataset"
import { normalizeContributor, type ContributorsFile } from "./contributors"
import { plainText, praiseText, clip, type ChannelFeed } from "./contributions-screen"
import { isPublicEvent, unwrapGoogleRedirect } from "./public-events"
import { photoSource } from "./photos"
import { getCardAddresses } from "./citizenwallet"
import { getCachedWalletAddress, setBatchCachedWalletAddresses } from "./wallet-address-cache"

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
  /** For a transfer: the other member. */
  to?: string
  from?: string
}

export interface RecapPraise {
  at: number
  from: { name: string; avatar?: string }
  text: string
}

export interface RecapPhoto {
  /** /data/YYYY/MM/public/images/…, to go through the image proxy. */
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

// ── periods ─────────────────────────────────────────────────────────────────

export type PeriodKind = "month" | "quarter" | "year"

export interface Period {
  kind: PeriodKind
  year: string
  /** "10" for a month, "Q4" for a quarter, "" for the year. */
  part: string
  /** The months it covers: ["10"], ["10", "11", "12"], ["01", …, "12"]. */
  months: string[]
}

const pad = (n: number) => String(n).padStart(2, "0")

/** /…/2026/10, /…/2026/Q4 or /…/2026; null for anything else. */
export function parsePeriod(year: string, part?: string): Period | null {
  if (!/^\d{4}$/.test(year)) return null
  if (part === undefined || part === "") return { kind: "year", year, part: "", months: Array.from({ length: 12 }, (_, i) => pad(i + 1)) }
  if (/^(0[1-9]|1[0-2])$/.test(part)) return { kind: "month", year, part, months: [part] }
  const q = /^q([1-4])$/i.exec(part)
  if (q) {
    const first = (Number(q[1]) - 1) * 3 + 1
    return { kind: "quarter", year, part: `Q${q[1]}`, months: [first, first + 1, first + 2].map(pad) }
  }
  return null
}

const monthOf = (year: string, month: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(Date.UTC(Number(year), Number(month) - 1, 15)).toLocaleDateString("en-GB", { ...opts, timeZone: TZ })

/** "October 2026", "October–December 2026", "2026"; without the year: "October", "October–December", "2026". */
export function periodName(p: Period, withYear = true): string {
  if (p.kind === "year") return p.year
  const first = monthOf(p.year, p.months[0], { month: "long" })
  const name = p.kind === "month" ? first : `${first}–${monthOf(p.year, p.months[2], { month: "long" })}`
  return withYear ? `${name} ${p.year}` : name
}

/** "2026/10", "2026/Q4", "2026". */
export const periodPath = (p: Period) => (p.part ? `${p.year}/${p.part}` : p.year)

/** The period before or after, of the same kind. */
export function shiftPeriod(p: Period, by: number): Period {
  if (p.kind === "year") return parsePeriod(String(Number(p.year) + by))!
  const step = p.kind === "quarter" ? 3 : 1
  const d = new Date(Date.UTC(Number(p.year), Number(p.months[0]) - 1 + by * step, 1))
  const y = String(d.getUTCFullYear())
  const m = d.getUTCMonth() + 1
  return parsePeriod(y, p.kind === "quarter" ? `Q${(m - 1) / 3 + 1}` : pad(m))!
}

/** Its first moment and the first moment after it, in Brussels, as epoch ms (to within the hour). */
export function periodBounds(p: Period): { from: number; to: number } {
  const start = Date.UTC(Number(p.year), Number(p.months[0]) - 1, 1) - 2 * 3_600_000
  const end = Date.UTC(Number(p.year), Number(p.months[p.months.length - 1]), 1) - 2 * 3_600_000
  return { from: start, to: end }
}

export interface Recap {
  member: RecapMember
  period: Period
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

/** "12 Oct". */
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })

/** "3 tokens", "1.5 tokens", "1 token". */
export function tokens(n: number): string {
  const v = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
  return `${v} ${n === 1 ? "token" : "tokens"}`
}

/** "Chinese lesson, to Dean"; "Sent to Dean" when there's no note. */
export function lineText(l: TokenLine): string {
  const who = l.to ? `to ${l.to}` : l.from ? `from ${l.from}` : ""
  if (!who) return l.what
  return l.what ? `${l.what}, ${who}` : l.to ? `Sent to ${l.to}` : `From ${l.from}`
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

export interface TokenTx {
  accountId: string
  counterparty?: string
  currency?: string
  type: string
  amount: number
  timestamp: number
  metadata?: { description?: string; note?: string; t?: string }
}

/** A /send note on Nostr: what a transfer was for. */
export interface TransferNote {
  /** Seconds. */
  at: number
  amount: number
  text: string
}

const FALLBACK: Record<string, string> = {
  shift: "Caretaking shift",
  mint: "Contribution",
}

/**
 * What a token movement was for, as a member reads it: "Issued 3 CHT to leen
 * for a 3h shift on …" → "For a 3h shift on …"; the attendees of a meeting
 * and the guest a pass was for are left out. A transfer without a note says
 * nothing ("" ): lineText names the other member instead.
 */
export function tokenReason(tx: Pick<TokenTx, "type" | "metadata">): string {
  const meta = tx.metadata ?? {}
  let text = (meta.description || meta.note || "").replace(/\s+/g, " ").trim()
  text = text.replace(/^Issued [\d.]+ \w+ to \S+ /i, "")
  if (/attendance/i.test(text)) text = text.replace(/:.*$/, "")
  if (/^(guest pass|coworking)/i.test(text)) text = text.replace(/:.*$/, "").replace(/ for \S+$/, "")
  text = text.replace(/ (room) room /i, " $1 ")
  if (text) return text.charAt(0).toUpperCase() + text.slice(1)
  if (tx.type === "DEBIT" || tx.type === "CREDIT") return ""
  return FALLBACK[meta.t ?? ""] ?? (tx.type === "BURN" ? "Spent (no reason given)" : "Issued (no reason given)")
}

const addressOf = (id: string | undefined) => (id ?? "").toLowerCase().split(":").pop() ?? ""

/** The note of a transfer: same amount, published within two minutes of it. Each note is used once. */
export function noteFor(tx: Pick<TokenTx, "amount" | "timestamp">, notes: TransferNote[], used: Set<TransferNote>): string {
  const note = notes
    .filter((n) => !used.has(n) && n.amount === Math.abs(tx.amount) && Math.abs(n.at - tx.timestamp) <= 120)
    .sort((a, b) => Math.abs(a.at - tx.timestamp) - Math.abs(b.at - tx.timestamp))[0]
  if (!note) return ""
  used.add(note)
  return note.text.charAt(0).toUpperCase() + note.text.slice(1)
}

/**
 * Their token movements: mints, and transfers to them, are received; burns
 * and transfers they made are spent. A transfer names the other member when
 * their account is known (`names`: address → name).
 */
export function tokenLines(txs: TokenTx[], address: string | null, names = new Map<string, string>(), notes: TransferNote[] = []): { received: TokenLine[]; spent: TokenLine[] } {
  const received: TokenLine[] = []
  const spent: TokenLine[] = []
  if (!address) return { received, spent }
  const me = address.toLowerCase()
  const used = new Set<TransferNote>()
  const other = (a: string) => names.get(a) ?? "another member"
  for (const tx of [...txs].sort((a, b) => a.timestamp - b.timestamp)) {
    if (tx.currency !== "CHT" || !tx.amount) continue
    const at = tx.timestamp * 1000
    const amount = Math.abs(tx.amount)
    const transfer = tx.type === "DEBIT" || tx.type === "CREDIT"
    const what = () => tokenReason(tx) || (transfer ? noteFor(tx, notes, used) : "")
    if (addressOf(tx.accountId) === me) {
      const line: TokenLine = { at, amount, what: what() }
      if (transfer) line[tx.amount < 0 ? "to" : "from"] = other(addressOf(tx.counterparty))
      ;(tx.amount > 0 ? received : spent).push(line)
    } else if (tx.type === "DEBIT" && addressOf(tx.counterparty) === me) {
      received.push({ at, amount, what: what(), from: other(addressOf(tx.accountId)) })
    }
  }
  return { received, spent }
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

/** The photos shared in #contributions, theirs first, then newest first. */
export function contributionPhotos(feed: ChannelFeed | null, member: RecapMember, limit = 24): RecapPhoto[] {
  const mine = (m: { author?: { id?: string } }) => (m.author?.id === member.id ? 0 : 1)
  return [...(feed?.messages ?? [])]
    .sort((a, b) => mine(a) - mine(b) || Date.parse(b.timestamp) - Date.parse(a.timestamp))
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

/** One month's files. */
export interface MonthFiles {
  door: DoorFile | null
  transactions: { transactions?: TokenTx[] } | null
  praise: ChannelFeed | null
  contributions: ChannelFeed | null
}

export function buildRecap(
  member: RecapMember,
  period: Period,
  months: MonthFiles[],
  events: EventsFile | null,
  address: string | null,
  { names = new Map<string, string>(), notes = [] as TransferNote[], now = new Date() } = {},
): Recap {
  const txs = months.flatMap((m) => m.transactions?.transactions ?? [])
  const { received, spent } = tokenLines(txs, address, names, notes)
  return {
    member,
    period,
    days: months.reduce((n, m) => n + doorDays(m.door, member), 0),
    received,
    spent,
    receivedTotal: sum(received),
    spentTotal: sum(spent),
    praise: months.flatMap((m) => praiseFor(m.praise, member)),
    photos: contributionPhotos({ messages: months.flatMap((m) => m.contributions?.messages ?? []) }, member),
    events: upcomingEvents(events, now),
  }
}

/** Discord ids and names of everyone the period's files mention: whose token accounts a transfer may be. */
export function peopleIn(months: MonthFiles[], issued: Array<{ issued?: Array<{ recipient?: { id?: string; displayName?: string } }> } | null>): Map<string, string> {
  const people = new Map<string, string>()
  const add = (id?: string | null, name?: string | null) => id && /^\d{5,25}$/.test(id) && name && !people.has(id) && people.set(id, name)
  for (const raw of readTierJson<ContributorsFile>("public", "contributors.json")?.contributors ?? []) {
    const c = normalizeContributor(raw)
    add(String(c.id), c.displayName || c.username)
  }
  for (const f of issued) for (const i of f?.issued ?? []) add(i.recipient?.id, i.recipient?.displayName)
  for (const m of months) {
    for (const o of m.door?.openers ?? []) add(o.id, o.name)
    for (const feed of [m.praise, m.contributions]) for (const msg of feed?.messages ?? []) [msg.author, ...(msg.mentions ?? [])].forEach((p) => add(p?.id, nameOf(p)))
  }
  return people
}

/** Token accounts of these Discord ids (cached; one multicall for the ones not yet known). */
async function accountsOf(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const missing: string[] = []
  for (const id of ids) {
    const cached = getCachedWalletAddress(id)
    if (cached) out.set(id, cached.toLowerCase())
    else missing.push(id)
  }
  if (missing.length) {
    const found = await getCardAddresses(missing).catch(() => new Map<string, string | null>())
    setBatchCachedWalletAddresses([...found.entries()].filter(([, a]) => a).map(([discordUserId, address]) => ({ discordUserId, address })))
    for (const [id, address] of found) if (address) out.set(id, address.toLowerCase())
  }
  return out
}

/** /send notes published on Nostr during the period. */
async function transferNotes(period: Period): Promise<TransferNote[]> {
  const { queryRelays } = await import("./nostr-server")
  const { from, to } = periodBounds(period)
  const events = await queryRelays({ kinds: [1111], "#t": ["send"], since: Math.floor(from / 1000) - 300, until: Math.floor(to / 1000) + 300, limit: 2000 }, 4000)
  return events
    .map((e) => ({ at: e.created_at, amount: Number(e.tags.find((t) => t[0] === "amount")?.[1]), text: plainText(e.content) }))
    .filter((n) => Number.isFinite(n.amount) && n.text)
}

export async function loadRecap(username: string, period: Period, now = new Date()): Promise<Recap | null> {
  const member = findMember(username)
  if (!member) return null
  const read = <T,>(month: string, file: string) => readTierJson<T>("members", file, period.year, month)
  const months: MonthFiles[] = period.months.map((m) => ({
    door: read(m, "door.json"),
    transactions: read(m, "transactions.json"),
    praise: read(m, "praise.json"),
    contributions: read(m, "contributions.json"),
  }))
  const people = peopleIn(
    months,
    period.months.map((m) => read(m, "tokens-issued.json")),
  )
  people.set(member.id, member.name)
  const accounts = await accountsOf([...people.keys()])
  const names = new Map<string, string>()
  for (const [id, address] of accounts) if (id !== member.id) names.set(address, people.get(id)!)
  const hasTransfers = months.some((m) => (m.transactions?.transactions ?? []).some((t) => t.type === "DEBIT"))
  const notes = hasTransfers ? await transferNotes(period).catch(() => []) : []
  return buildRecap(member, period, months, readTierJson<EventsFile>("public", "events.json"), accounts.get(member.id) ?? null, { names, notes, now })
}
