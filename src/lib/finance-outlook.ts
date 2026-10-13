/**
 * Where the Hub stands, for the top of /finance: the money in the accounts
 * right now, what is still to pay, how fast money goes out (the burn rate),
 * and how long the cash lasts at that pace (the runway).
 *
 * - Cash: the live balances of the active accounts, as /finance totals them.
 * - Still to pay: the unpaid bills in the books (chb's pending-bills.json,
 *   as /contribute lists them) and the next month of the costs that come
 *   back every month (rent, furniture, internet, electricity; /contribute).
 * - Burn rate: what the Hub itself received and spent per month, averaged
 *   over the last complete months. Transfers between our own accounts are
 *   left out, and so is the money of the projects we host (a transaction
 *   tagged with another collective): it is theirs, not the Hub's. Accounts
 *   archived since (the old savings account, emptied by the May 2026 hack)
 *   count until the day they were archived: that is where most income
 *   landed before. What the books call exceptional (the hack itself) is
 *   not spending: it is shown apart and kept out of the averages.
 * - Runway: cash left after the unpaid bills, divided by the net burn
 *   (spending minus income). With no net burn there is no end in sight.
 */

import settings from "@/settings/settings.json"

import { loadContributeExpenses, type ContributableExpense } from "./contribute-expenses"
import { readMonthlyTransactions } from "./transactions"
import type { Transaction } from "@/types/transactions"

export interface MonthFlow {
  /** "2026-09" */
  month: string
  income: number
  spending: number
  /** One-off losses the books tag "exceptional" (the May 2026 hack), kept out of spending. */
  exceptional?: number
}

export interface FixedCost {
  slug: string
  label: string
  /** A month of it. */
  monthly: number
  /** Billed once a year: the yearly amount (monthly is a twelfth of it). */
  annual?: number
}

export interface FinanceOutlook {
  cash: number
  /** Unpaid EUR bills in the books; null when chb has not published the list. */
  unpaidBills: { amount: number; count: number; overdue: number; overdueCount: number } | null
  fixedCosts: FixedCost[]
  /** A month of every fixed cost, the yearly taxes as a twelfth. */
  fixedMonthly: number
  /** What comes back every month (no yearly bills): what next month asks for. */
  nextMonthFixed: number
  /** Cash once the unpaid bills and next month's costs are paid. */
  afterCommitments: number
  /** The last complete months, oldest first, plus the current one (partial: true). */
  months: Array<MonthFlow & { partial?: boolean }>
  /** Averages over `window` complete months. */
  window: number
  avgIncome: number
  avgSpending: number
  /** avgSpending − avgIncome; 0 or less means income covers spending. */
  netBurn: number
  /** Months the cash left after the unpaid bills lasts at the net burn; null without a net burn. */
  runwayMonths: number | null
  /** Months of fixed costs the cash left after the unpaid bills covers, with no income at all. */
  fixedCostsCovered: number
}

const round2 = (n: number) => Math.round(n * 100) / 100
const MONEY = new Set(["EUR", "EURe", "EURb"])

/** A transaction that moves the Hub's own money in or out (not between our accounts, not a hosted project's). */
export function isHubFlow(tx: Pick<Transaction, "type" | "currency" | "metadata">): boolean {
  if (tx.type === "INTERNAL") return false
  if (tx.currency && !MONEY.has(tx.currency)) return false
  const meta = (tx.metadata ?? {}) as { category?: string; collective?: string; excluded?: boolean }
  if (meta.excluded || meta.category === "internal_transfer") return false
  return !meta.collective || meta.collective === "commonshub"
}

/**
 * Income and spending of one month of transactions on the given accounts,
 * each counted until the moment it was archived (seconds; Infinity while active).
 */
export function monthFlow(month: string, txs: Transaction[], accounts: Map<string, number>): MonthFlow {
  let income = 0
  let spending = 0
  let exceptional = 0
  for (const tx of txs) {
    const until = accounts.get(tx.accountSlug)
    if (until === undefined || tx.timestamp > until || !isHubFlow(tx)) continue
    const amount = tx.normalizedAmount ?? tx.amount ?? 0
    if (amount < 0 && (tx.metadata as { category?: string } | undefined)?.category === "exceptional") exceptional -= amount
    else if (amount >= 0) income += amount
    else spending -= amount
  }
  return { month, income: round2(income), spending: round2(spending), ...(exceptional ? { exceptional: round2(exceptional) } : {}) }
}

/** Every configured account by the names transactions use (slug, Stripe account id), with when it stopped counting. */
export function accountWindows(accounts: Array<{ slug: string; accountId?: string; archivedAt?: string | null }>): Map<string, number> {
  const out = new Map<string, number>()
  for (const a of accounts) {
    const until = a.archivedAt ? Date.parse(`${a.archivedAt}T23:59:59Z`) / 1000 : Infinity
    for (const name of [a.slug, a.accountId]) if (name) out.set(name, Math.max(out.get(name) ?? -Infinity, until))
  }
  return out
}

/** The `count` months before `now`'s month, oldest first, then `now`'s month. */
export function outlookMonths(now: Date, count: number): string[] {
  const out: string[] = []
  for (let i = count; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`)
  }
  return out
}

export function fixedCostsOf(recurring: ContributableExpense[]): FixedCost[] {
  return recurring
    .filter((c) => c.amountEur > 0)
    .map((c) => ({ slug: c.slug, label: c.label, monthly: c.amountEur, ...(c.annualAmount ? { annual: c.annualAmount } : {}) }))
}

/** The numbers, from what was read. Pure, so the arithmetic is tested. */
export function computeOutlook(input: {
  cash: number
  unpaid: Array<{ amountDue: number; overdue?: boolean }> | null
  fixedCosts: FixedCost[]
  /** Oldest first; the last one is the current, partial month. */
  months: MonthFlow[]
  window?: number
}): FinanceOutlook {
  const window = input.window ?? 6
  const complete = input.months.slice(0, -1)
  const recent = complete.slice(-window)
  const n = recent.length || 1
  const avgIncome = round2(recent.reduce((s, m) => s + m.income, 0) / n)
  const avgSpending = round2(recent.reduce((s, m) => s + m.spending, 0) / n)
  const netBurn = round2(avgSpending - avgIncome)

  const unpaidBills = input.unpaid
    ? {
        amount: round2(input.unpaid.reduce((s, b) => s + b.amountDue, 0)),
        count: input.unpaid.length,
        overdue: round2(input.unpaid.filter((b) => b.overdue).reduce((s, b) => s + b.amountDue, 0)),
        overdueCount: input.unpaid.filter((b) => b.overdue).length,
      }
    : null

  const fixedMonthly = round2(input.fixedCosts.reduce((s, c) => s + c.monthly, 0))
  const nextMonthFixed = round2(input.fixedCosts.filter((c) => !c.annual).reduce((s, c) => s + c.monthly, 0))
  const cash = round2(input.cash)
  const afterBills = round2(cash - (unpaidBills?.amount ?? 0))

  return {
    cash,
    unpaidBills,
    fixedCosts: input.fixedCosts,
    fixedMonthly,
    nextMonthFixed,
    afterCommitments: round2(afterBills - nextMonthFixed),
    months: input.months.map((m, i) => (i === input.months.length - 1 ? { ...m, partial: true } : m)),
    window: recent.length,
    avgIncome,
    avgSpending,
    netBurn,
    runwayMonths: netBurn > 0 ? Math.max(0, Math.round((afterBills / netBurn) * 10) / 10) : null,
    fixedCostsCovered: fixedMonthly > 0 ? Math.max(0, Math.round((afterBills / fixedMonthly) * 10) / 10) : 0,
  }
}

/** Reads the dataset: the last 12 complete months of transactions, the unpaid bills and the fixed costs. */
export function loadFinanceOutlook(cash: number, now: Date = new Date()): FinanceOutlook {
  const accounts = accountWindows(settings.finance.accounts as Array<{ slug: string; accountId?: string; archivedAt?: string | null }>)
  const months = outlookMonths(now, 12).map((month) => {
    const [y, m] = month.split("-")
    return monthFlow(month, readMonthlyTransactions(y, m, "public"), accounts)
  })
  const expenses = loadContributeExpenses({ now })
  return computeOutlook({
    cash,
    unpaid: expenses.pending ? expenses.oneTime.map((b) => ({ amountDue: b.amountEur, overdue: b.overdue })) : null,
    fixedCosts: fixedCostsOf(expenses.recurring),
    months,
  })
}
