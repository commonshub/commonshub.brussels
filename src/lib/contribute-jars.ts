/**
 * /contribute/screen as two jars that keep the hub open:
 *
 * - money: what the space costs a month, as layers (cheapest bills at the
 *   bottom, rent on top), filled from the bottom by this month's income:
 *   memberships and donations as received, net of refunds and fees (chb's
 *   public summary.json, per category), and bookings (rooms, coworking, their
 *   catering) as invoiced this month, without VAT (chb's customers.json,
 *   from Odoo): a booking is usually paid after the month it is invoiced in,
 *   and counting it once, when invoiced, never counts it twice. The parts
 *   shown always add up to the amount covered.
 * - time: hours given this month, counted as one hour per community token
 *   issued (tokens-issued.json), by kind (from each token's reason). The jar
 *   is sized on the busier of this month and last, with last month marked.
 *
 * Only the public tier is read.
 */

import type { Tier } from "./data-paths"
import { readTierJson } from "./dataset"
import type { RecentContributor, RecentDonation, ScreenCost, TokensIssuedFeed } from "./contribute-screen"

const TIER: Tier = "public"

/** What the community pays toward the space, and how the screen names it. */
export const COVERING = [
  { slugs: ["membership"], label: "Memberships" },
  { slugs: ["donation"], label: "Donations" },
] as const

/** The kinds of invoiced income that are bookings: rooms, coworking, the catering that comes with them. */
const BOOKING_TYPES = new Set(["sales_services", "rental", "rentals", "coworking", "catering"])

/** chb's month of invoices (YYYY/MM/public/customers.json, from Odoo): per customer, the kind of income and the amount without VAT. */
export interface CustomersFile {
  customers?: Array<{ incomeType?: string; untaxedAmount?: number | null }>
}

interface SummaryFile {
  categories?: Array<{ slug: string; currencies?: Array<{ currency: string; in?: number; out?: number; net?: number }> }>
}

export interface Income {
  label: string
  /** Euros, net, rounded down to the euro. */
  amount: number
  /** Counted when invoiced rather than when paid. */
  invoiced?: boolean
}

/**
 * This month's money toward the space, per kind, largest first, in whole
 * euros: memberships and donations received (net of refunds and fees, never
 * below zero), bookings invoiced (without VAT). Kinds with nothing are left out.
 */
export function monthIncome(summary: SummaryFile | null, customers: CustomersFile | null = null): Income[] {
  const net = (slug: string) => {
    const eur = summary?.categories?.find((c) => c.slug === slug)?.currencies?.find((c) => c.currency === "EUR")
    return eur ? (eur.net ?? (eur.in ?? 0) - (eur.out ?? 0)) : 0
  }
  const bookings = (customers?.customers ?? []).filter((c) => BOOKING_TYPES.has(c.incomeType ?? "")).reduce((sum, c) => sum + (Number(c.untaxedAmount) || 0), 0)
  return [
    ...COVERING.map(({ slugs, label }) => ({ label, amount: Math.floor(Math.max(0, slugs.reduce((sum, s) => sum + net(s), 0))) })),
    { label: "Bookings", amount: Math.floor(Math.max(0, bookings)), invoiced: true },
  ]
    .filter((i) => i.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export interface CostLayer extends ScreenCost {
  /** Fractions of the month's total, from the bottom of the jar: where the layer starts and ends. */
  from: number
  to: number
  /** How much of it is paid, in euros (0..amount). */
  paid: number
}

/** The costs stacked cheapest first, each with how much of it this month's money covers. */
export function costLayers(costs: ScreenCost[], covered: number): CostLayer[] {
  const total = costs.reduce((sum, c) => sum + c.amount, 0)
  if (total <= 0) return []
  let below = 0
  return [...costs]
    .sort((a, b) => a.amount - b.amount)
    .map((c) => {
      const layer = { ...c, from: below / total, to: (below + c.amount) / total, paid: Math.max(0, Math.min(c.amount, covered - below)) }
      below += c.amount
      return layer
    })
}

export type HourKind = "shifts" | "cleaning" | "cooking" | "fixing" | "other"

export const HOUR_KINDS: Array<{ kind: HourKind; label: string; emoji: string; match?: RegExp }> = [
  { kind: "shifts", label: "Shifts", emoji: "🕗", match: /shift|steward|host|welcom|door|reception/i },
  { kind: "cleaning", label: "Cleaning", emoji: "🧹", match: /clean|vacu|mop|sweep|dish|tidy|wash|trash|garbage|park/i },
  { kind: "cooking", label: "Cooking", emoji: "🍲", match: /cook|food|potluck|meal|soup|lunch|dinner|kitchen|bak/i },
  { kind: "fixing", label: "Fixing", emoji: "🔧", match: /fix|repair|build|install|paint|plant|water|garden|move|carry/i },
  { kind: "other", label: "Other help", emoji: "✨" },
]

export interface HourLayer {
  kind: HourKind
  label: string
  emoji: string
  hours: number
}

/** Hours given in a month, by kind, largest first: one per token issued. */
export function hoursByKind(feed: TokensIssuedFeed | null): HourLayer[] {
  const totals = new Map<HourKind, number>()
  for (const t of feed?.issued ?? []) {
    const amount = Number(t.amount)
    if (!(amount > 0)) continue
    const kind = HOUR_KINDS.find((k) => k.match?.test(t.reason ?? ""))?.kind ?? "other"
    totals.set(kind, (totals.get(kind) ?? 0) + amount)
  }
  return HOUR_KINDS.filter((k) => (totals.get(k.kind) ?? 0) > 0)
    .map((k) => ({ kind: k.kind, label: k.label, emoji: k.emoji, hours: Math.round(totals.get(k.kind)! * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)
}

/** A transaction of the hub as the screen shows it: signed amount, its category as a short tag, maybe a few words. */
export interface TxLine {
  id: string
  /** Milliseconds. */
  at: number
  /** Euros, signed: money in is positive, money out negative. */
  amount: number
  /** The category's slug ("" when uncategorised) and its short name. */
  slug: string
  tag: string
  /** What it was, when that says something and names nobody: "Rent CHB October 2026". */
  note?: string
  /** A donation: how it came, and the name the donor chose to show (if any). */
  donation?: Pick<RecentDonation, "via" | "name">
  /** The same thing several times that day (memberships of €10): how many. */
  count?: number
}

interface PublicTx {
  id?: string
  currency?: string
  type?: string
  amount?: number | string
  timestamp?: number | string
  metadata?: { category?: string; collective?: string; description?: string; excluded?: boolean } | null
}

/** Moving money between the hub's own accounts, or a few cents of Stripe fees: not worth a line on a screen. */
const HIDDEN = new Set(["internal_transfer", "opening_balance", "stripe_fee"])

/** Short names for chb's categories (categories.json), where its label is long. */
const SHORT: Record<string, string> = {
  rental: "Booking",
  rentals: "Booking",
  consulting: "Contractor",
  accounting: "Accounting",
  furniture: "Furniture",
  internet: "Internet",
  HR: "Salaries",
  salaries: "Salaries",
  webservice: "Web services",
  bank_fees: "Bank fees",
  "other-income": "Other income",
  "other-expense": "Other expense",
  donations_given: "Donation given",
  expense: "Reimbursement",
  exceptional: "Exceptional",
  accrual: "Last year's invoice",
}

/** A description worth showing: words, not an invoice number or a payment reference. */
const readable = (d: string | undefined) => !!d && d.length <= 50 && /[a-z]{3}/.test(d) && !/\+\+\+|[A-Z]{2,}[-/ ]?\d|\d{4}\/\d|^\d+$/.test(d)

/**
 * The hub's latest money in and out, newest first: every category (rent paid
 * as much as a membership), each tagged; uncategorised ones say so. Only
 * money spent says what it was (to whom the hub pays is public); money
 * received never does (a description can name a person), except a donor
 * who chose to be named at checkout.
 */
export function latestTransactions(txs: PublicTx[], labels: Map<string, string>, donations: RecentDonation[] = [], limit = 6): TxLine[] {
  const seen = new Set<string>()
  const day = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })
  const lines = txs
    .filter((t) => {
      const m = t.metadata ?? {}
      const at = Number(t.timestamp)
      const id = t.id ?? `${t.timestamp}-${t.amount}`
      if (m.excluded || m.collective !== "commonshub" || !["EUR", "EURe"].includes(t.currency ?? "") || t.type === "INTERNAL") return false
      if (HIDDEN.has(m.category ?? "") || !Number.isFinite(at) || !Number(t.amount) || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .map((t): TxLine => {
      const m = t.metadata ?? {}
      const slug = m.category ?? ""
      const amount = Number(t.amount)
      const at = Number(t.timestamp) * 1000
      const donation = slug === "donation" ? donations.find((d) => d.at === at) : undefined
      return {
        id: t.id ?? `${t.timestamp}-${t.amount}`,
        at,
        amount,
        slug,
        tag: slug ? (SHORT[slug] ?? labels.get(slug) ?? slug.replace(/[_-]/g, " ")) : "Uncategorised",
        ...(amount < 0 && readable(m.description) ? { note: m.description } : {}),
        ...(donation ? { donation: { via: donation.via, name: donation.name } } : {}),
      }
    })
  // The same amount for the same thing on the same day, one after the other, is one line: "+€10 Membership ×3".
  const out: TxLine[] = []
  for (const l of lines) {
    const prev = out[out.length - 1]
    if (prev && prev.slug === l.slug && prev.amount === l.amount && !prev.note && !l.note && !prev.donation?.name && !l.donation?.name && day(prev.at) === day(l.at)) {
      prev.count = (prev.count ?? 1) + 1
      continue
    }
    if (out.length === limit) break
    out.push(l)
  }
  return out
}

/** The month's transactions and the one before, newest first, from the public tier; and the categories' names. */
export function loadLatestTransactions(donations: RecentDonation[], now = new Date(), limit = 9): TxLine[] {
  const months = [monthKey(now), monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))]
  const txs = months.flatMap(([y, m]) => {
    const file = readTierJson<{ transactions?: PublicTx[] } | PublicTx[]>(TIER, "transactions.json", y, m)
    return Array.isArray(file) ? file : (file?.transactions ?? [])
  })
  const categories = readTierJson<{ categories?: Array<{ slug: string; label: string }> }>(TIER, "categories.json")
  const labels = new Map((categories?.categories ?? []).map((c) => [c.slug, c.label]))
  return latestTransactions(txs, labels, donations, limit)
}

export interface JarsData {
  layers: CostLayer[]
  total: number
  income: Income[]
  covered: number
  hours: HourLayer[]
  hoursTotal: number
  lastMonthHours: number
  monthName: string
}

const monthKey = (d: Date) => [String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0")] as const

export function loadJars(costs: ScreenCost[], now = new Date()): JarsData {
  const [y, m] = monthKey(now)
  const [py, pm] = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))
  const income = monthIncome(readTierJson<SummaryFile>(TIER, "summary.json", y, m), readTierJson<CustomersFile>(TIER, "customers.json", y, m))
  const covered = income.reduce((sum, i) => sum + i.amount, 0)
  const hours = hoursByKind(readTierJson<TokensIssuedFeed>(TIER, "tokens-issued.json", y, m))
  const last = hoursByKind(readTierJson<TokensIssuedFeed>(TIER, "tokens-issued.json", py, pm))
  return {
    layers: costLayers(costs, covered),
    total: costs.reduce((sum, c) => sum + c.amount, 0),
    income,
    covered,
    hours,
    hoursTotal: hours.reduce((sum, h) => sum + h.hours, 0),
    lastMonthHours: last.reduce((sum, h) => sum + h.hours, 0),
    monthName: now.toLocaleDateString("en-GB", { month: "long", timeZone: "Europe/Brussels" }),
  }
}
