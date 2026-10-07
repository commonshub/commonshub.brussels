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
  const bookings = (customers?.customers ?? []).filter((c) => c.incomeType === "sales_services").reduce((sum, c) => sum + (Number(c.untaxedAmount) || 0), 0)
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

export type FeedLine = { kind: "money"; at: number; donation: RecentDonation } | { kind: "time"; at: number; award: RecentContributor }

/** Donations and tokens issued together, newest first. */
export function latestLines(donations: RecentDonation[], awards: RecentContributor[], limit = 6): FeedLine[] {
  return [
    ...donations.map((d) => ({ kind: "money" as const, at: d.at, donation: d })),
    ...awards.filter((a) => a.tokens).map((a) => ({ kind: "time" as const, at: a.at, award: a })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
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
