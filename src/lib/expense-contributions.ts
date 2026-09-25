/**
 * Who chipped in for one expense.
 *
 * A contribution is recognised by the message it carries, which is how the
 * Hub asks people to pay: "Contribution phone booth", "Contribution
 * CHB-S/2026/09/0011", the older "Contribution <slug> - <label>", or the
 * Stripe product of a monthly card payment ("Monthly contribution:
 * <label>"). Only money coming in counts.
 *
 * Amounts and counts are public; names come from the members tier and are
 * shown to members only, like the donors list (lib/donors.ts).
 */

import type { Tier } from "./data-paths"
import { listMonths, listYears } from "./dataset"
import { type Donor, rankDonors } from "./donors"
import { readMonthlyTransactions } from "./transactions"

export interface ExpenseMatch {
  slug: string
  label: string
  short?: string
  reference: string
}

export interface ExpenseContributions {
  count: number
  total: number
  /** Largest first; empty unless read from the members tier. */
  contributors: Donor[]
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Does this description say it pays towards the expense? */
export function contributionMatcher(expense: ExpenseMatch): (description: string) => boolean {
  const keys = [...new Set([expense.short, expense.slug, expense.reference, expense.label].filter((k): k is string => !!k && k.length >= 3))]
  const pattern = new RegExp(`\\bcontribution:?\\s+(?:${keys.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "iu")
  return (description) => pattern.test(description)
}

const dayOf = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10)

export function loadExpenseContributions(expense: ExpenseMatch, tier: Tier): ExpenseContributions {
  const matches = contributionMatcher(expense)
  let count = 0
  let total = 0
  const gifts: Array<{ name: string | null | undefined; amount: number; date: string }> = []
  for (const year of listYears()) {
    for (const month of listMonths(year, tier)) {
      for (const tx of readMonthlyTransactions(year, month, tier)) {
        const meta = tx.metadata ?? {}
        const text = [meta.description, meta.fullDescription, meta.memo].filter((x): x is string => typeof x === "string").join(" ")
        if (tx.amount <= 0 || !matches(text)) continue
        count++
        total += tx.amount
        if (tier === "members") gifts.push({ name: tx.counterparty, amount: tx.amount, date: dayOf(tx.timestamp) })
      }
    }
  }
  return { count, total: Math.round(total * 100) / 100, contributors: tier === "members" ? rankDonors(gifts).largest : [] }
}
