/**
 * /donate/screen: the money the Commons Hub received today, live, against
 * what a month of the space costs.
 *
 * Read straight from the two places money arrives, not from chb's dataset
 * (which is a few hours behind):
 * - Stripe: card payments (donations, memberships, bookings paid by card),
 *   from the balance transactions, gross;
 * - Monerium: bank transfers into the hub's EURe accounts ("issue" orders).
 *   Stripe's payouts land there too, and the hub moves money in from its own
 *   KBC account: both are left out, so nothing is counted twice.
 *
 * What leaves this module names nobody: an amount, a time, how it came, what
 * kind of payment it was (guessed from Stripe's description or the transfer's
 * message, which is never shown), and a donor's name only as they chose to be
 * thanked at checkout (lib/donor-thanks.ts).
 */

import Stripe from "stripe"

import settings from "@/settings/settings.json"
import { loadStripeThanks, type StripeThanks } from "./donor-thanks"
import type { MoneriumOrder } from "./monerium"

export type ReceivedKind = "donation" | "membership" | "payment"

export interface Received {
  /** Milliseconds. */
  at: number
  /** Euros, gross. */
  amount: number
  via: "card" | "bank transfer"
  kind: ReceivedKind
  /** As the donor chose to be shown; null for no name. */
  name: string | null
}

export interface DonateToday {
  /** Today's payments, newest first. */
  today: Received[]
  /** Euros received today. */
  todayTotal: number
  /** Days in this month (Brussels): a day of the hub is a month's costs divided by it. */
  daysInMonth: number
  /** When this was read (ms). */
  at: number
}

const TZ = "Europe/Brussels"

/** Brussels' offset from UTC at a moment, in ms ("GMT+02:00" → 7 200 000). */
function offsetAt(ms: number): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(ms).find((p) => p.type === "timeZoneName")?.value ?? ""
  const m = /([+-])(\d{2}):?(\d{2})?/.exec(name)
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) * 60_000 : 0
}

/** Midnight in Brussels, as epoch ms, of the day (or the first of the month) `now` falls in. */
export function brusselsStart(now: Date, unit: "day" | "month"): number {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number)
  const utc = Date.UTC(y, m - 1, unit === "day" ? d : 1)
  return utc - offsetAt(utc - offsetAt(utc))
}

const DONATION = /donat|\bdon\b|\bgift\b|schenking/i
const MEMBERSHIP = /member|subscription|lidmaatschap|cotisation|adh[ée]sion/i

function kindOf(text: string | null | undefined): ReceivedKind {
  const t = text ?? ""
  if (DONATION.test(t)) return "donation"
  if (MEMBERSHIP.test(t)) return "membership"
  return "payment"
}

/** Stripe's balance transactions that are money paid to the hub by card. */
export function stripeReceived(txs: Array<Pick<Stripe.BalanceTransaction, "type" | "reporting_category" | "amount" | "currency" | "created" | "description">>): Received[] {
  return txs
    .filter((t) => (t.type === "charge" || t.type === "payment") && t.reporting_category === "charge" && t.amount > 0 && t.currency === "eur")
    .map((t) => ({ at: t.created * 1000, amount: t.amount / 100, via: "card" as const, kind: kindOf(t.description), name: null }))
}

/** The hub's EURe accounts that receive bank transfers (settings.finance.accounts, not archived), lowercase. */
const HUB_ADDRESSES = new Set(
  settings.finance.accounts
    .filter((a) => a.provider === "etherscan" && "token" in a && a.token?.symbol === "EURe" && !("archivedAt" in a && a.archivedAt))
    .map((a) => ("address" in a ? String(a.address).toLowerCase() : "")),
)
/** The hub's own bank accounts: money moved from them is not money received. */
const HUB_IBANS = new Set(settings.finance.accounts.filter((a) => "iban" in a && a.iban).map((a) => String((a as { iban: string }).iban).replace(/\s/g, "")))
/** Transfers that are the hub's own money arriving: Stripe's payouts, or the hub sending to itself. */
const OWN_SENDER = /stripe|commons\s*hub/i

/** Monerium orders that are bank transfers paid to the hub. */
export function moneriumReceived(orders: MoneriumOrder[], addresses: Set<string> = HUB_ADDRESSES, ownIbans: Set<string> = HUB_IBANS): Received[] {
  return orders
    .filter((o) => o.kind === "issue" && o.state === "processed" && o.currency?.toLowerCase() === "eur" && addresses.has(o.address?.toLowerCase()))
    .filter((o) => !ownIbans.has((o.counterpart?.identifier?.iban ?? "").replace(/\s/g, "")) && !OWN_SENDER.test(o.counterpart?.details?.name ?? ""))
    .map((o) => ({ at: Date.parse(o.meta.processedAt), amount: Number(o.amount), via: "bank transfer" as const, kind: kindOf(o.memo), name: null }))
    .filter((r) => Number.isFinite(r.at) && r.amount > 0)
}

/** A card donation takes the name its donor chose (same amount, paid within the hour after the checkout opened). */
export function nameDonors(received: Received[], thanks: StripeThanks[] | null): Received[] {
  if (!thanks) return received
  const used = new Set<StripeThanks>()
  return received.map((r) => {
    if (r.via !== "card" || r.kind !== "donation") return r
    const sec = r.at / 1000
    const cents = Math.round(r.amount * 100)
    const match = thanks
      .filter((t) => !used.has(t) && t.amount === cents && t.created <= sec + 300 && sec - t.created < 3600)
      .sort((a, b) => Math.abs(sec - a.created) - Math.abs(sec - b.created))[0]
    if (!match) return r
    used.add(match)
    return { ...r, name: match.name }
  })
}

/** Today's payments, from everything received lately. */
export function summarise(received: Received[], now: Date): DonateToday {
  const dayStart = brusselsStart(now, "day")
  const cents = (rs: Received[]) => Math.round(rs.reduce((sum, r) => sum + r.amount * 100, 0)) / 100
  const today = received.filter((r) => r.at >= dayStart && r.at <= now.getTime()).sort((a, b) => b.at - a.at)
  return {
    today,
    todayTotal: cents(today),
    daysInMonth: Math.round((brusselsStart(new Date(brusselsStart(now, "month") + 32 * 86_400_000), "month") - brusselsStart(now, "month")) / 86_400_000),
    at: now.getTime(),
  }
}

async function stripeSince(sinceMs: number): Promise<Received[]> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return []
  const txs = await new Stripe(key).balanceTransactions.list({ created: { gte: Math.floor(sinceMs / 1000) }, limit: 100 }).autoPagingToArray({ limit: 2000 })
  return stripeReceived(txs)
}

async function moneriumOrders(): Promise<MoneriumOrder[]> {
  const id = process.env.MONERIUM_CLIENT_ID
  const secret = process.env.MONERIUM_CLIENT_SECRET
  if (!id || !secret) return []
  const auth = await fetch("https://api.monerium.app/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    cache: "no-store",
  })
  const { access_token } = (await auth.json()) as { access_token?: string }
  if (!access_token) throw new Error("monerium: no access token")
  const res = await fetch("https://api.monerium.app/orders?state=processed", {
    headers: { Authorization: `Bearer ${access_token}`, Accept: "application/vnd.monerium.api-v2+json" },
    cache: "no-store",
  })
  return ((await res.json()) as { orders?: MoneriumOrder[] }).orders ?? []
}

/** Both sources are read at most once a minute, however many screens ask. */
const TTL_MS = 60_000
let cache: { at: number; value: DonateToday } | null = null
let pending: Promise<DonateToday> | null = null
/** What each source last gave: one that fails keeps it rather than dropping to zero. */
let last: { card: Received[]; transfers: Received[] } = { card: [], transfers: [] }

export async function loadDonateToday(now = new Date()): Promise<DonateToday> {
  if (cache && now.getTime() - cache.at < TTL_MS) return cache.value
  pending ??= (async () => {
    const [card, transfers, thanks] = await Promise.all([
      stripeSince(brusselsStart(now, "day")).catch((error) => {
        console.error("[donate-today] stripe:", error)
        return last.card
      }),
      moneriumOrders()
        .then((orders) => moneriumReceived(orders))
        .catch((error) => {
          console.error("[donate-today] monerium:", error)
          return last.transfers
        }),
      loadStripeThanks(Math.floor(brusselsStart(now, "day") / 1000) - 3600),
    ])
    last = { card, transfers }
    const value = summarise([...nameDonors(card, thanks), ...transfers], now)
    cache = { at: now.getTime(), value }
    return value
  })().finally(() => {
    pending = null
  })
  return pending
}
