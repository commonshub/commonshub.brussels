/**
 * What every recap email also tells, member or not: the next featured events
 * (the ones we host, with their own page), the money that came in over the
 * period against what the hub costs to run (the fixed costs, as on /finance),
 * and the care shifts (how many people kept the space open, and for how many
 * hours, from the shifts calendar).
 */

import settings from "@/settings/settings.json"
import { fixedCostsOf, accountWindows, monthFlow } from "./finance-outlook"
import { loadContributeExpenses } from "./contribute-expenses"
import { readMonthlyTransactions } from "./transactions"
import { hostedEvents, type HostedEvent } from "./hosted-events"
import { periodBounds, SITE, type Period } from "./monthly-recap"

export interface FeaturedEvent {
  name: string
  /** ISO. */
  start: string
  url: string
  tagline?: string
  /** Absolute URL of its cover image. */
  cover?: string
}

export interface RecapCommunity {
  /** Euros that came in over the period (income on the hub's accounts, as /finance counts it). */
  income: number
  /** The fixed costs over the period (a month of them times the months), and the biggest ones a month. */
  costs: number
  months: number
  mainCosts: Array<{ label: string; monthly: number }>
  /** Care shifts over the period; null when the shifts calendar couldn't be read. */
  care: { people: number; hours: number } | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Hosted events still to come that /events features, soonest first. */
export function featuredEvents(now = new Date(), limit = 2, hosted: HostedEvent[] = hostedEvents): FeaturedEvent[] {
  return hosted
    .filter((h) => h.featured !== false && Date.parse(h.endAt) > now.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, limit)
    .map((h) => ({ name: h.name, start: h.startAt, url: `${SITE}/events/${h.slug}`, ...(h.tagline ? { tagline: h.tagline } : {}), ...(h.coverImage ? { cover: h.coverImage.startsWith("/") ? `${SITE}${h.coverImage}` : h.coverImage } : {}) }))
}

/** Distinct people and total hours of the care shifts (one signup = its shift's hours). */
export function careOf(shifts: Array<{ start: string; end: string; signups: Array<{ key?: string; username: string }> }>): { people: number; hours: number } {
  const people = new Set<string>()
  let hours = 0
  for (const s of shifts) {
    const h = (Date.parse(s.end) - Date.parse(s.start)) / 3_600_000
    if (!(h > 0)) continue
    for (const p of s.signups) {
      people.add(p.key ?? p.username)
      hours += h
    }
  }
  return { people: people.size, hours: Math.round(hours * 10) / 10 }
}

export async function loadCommunity(period: Period, now = new Date()): Promise<RecapCommunity> {
  const accounts = accountWindows(settings.finance.accounts as Array<{ slug: string; accountId?: string; archivedAt?: string | null }>)
  const income = round2(period.months.reduce((sum, m) => sum + monthFlow(`${period.year}-${m}`, readMonthlyTransactions(period.year, m, "public"), accounts).income, 0))
  const fixed = fixedCostsOf(loadContributeExpenses({ now }).recurring)
  const fixedMonthly = fixed.reduce((s, c) => s + c.monthly, 0)
  const mainCosts = [...fixed].sort((a, b) => b.monthly - a.monthly).slice(0, 3).map((c) => ({ label: c.label, monthly: Math.round(c.monthly) }))
  let care: RecapCommunity["care"] = null
  try {
    const { isShiftsConfigured, listShifts } = await import("./shifts-service")
    if (isShiftsConfigured()) {
      const { from, to } = periodBounds(period)
      care = careOf(await listShifts(new Date(from), new Date(Math.min(to, now.getTime()))))
    }
  } catch (error) {
    console.error("[recap] care shifts:", error)
  }
  return { income, costs: round2(fixedMonthly * period.months.length), months: period.months.length, mainCosts, care }
}
