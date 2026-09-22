/**
 * What the /finance pages show, computed from the tiered dataset.
 *
 * Every row comes from `YYYY/MM/<tier>/transactions.json` (amounts already
 * decoded to units), joined with that tier's counterparties.json. The
 * members tier names the counterparties; the public tier does not, so a
 * public page has nothing to name and cannot leak one. No page reads a
 * provider archive or a per-chain raw export any more.
 */

import settings from "@/settings/settings.json"
import type { Tier } from "./data-paths"
import { listMonths } from "./dataset"
import {
  augmentTransaction,
  readMonthlyCounterpartyMetadata,
  readMonthlyTransactions,
  type AugmentedTransaction,
} from "./transactions"
import { counterpartyLabel } from "@/types/counterparties"

export type FinanceAccount = (typeof settings.finance.accounts)[number]

export function findFinanceAccount(slug: string): FinanceAccount | undefined {
  return settings.finance.accounts.find((a) => a.slug === slug)
}

/** How to label an account's amounts, whatever its provider. */
export function accountDisplay(account: FinanceAccount): { symbol: string; chain: string; address: string } {
  const a = account as { token?: { symbol?: string }; currency?: string; chain?: string; address?: string; iban?: string }
  return {
    symbol: a.token?.symbol ?? a.currency ?? "EUR",
    chain: a.chain ?? account.provider,
    address: a.address ?? a.iban ?? "",
  }
}

function belongsTo(tx: AugmentedTransaction, account: FinanceAccount): boolean {
  const a = account as { accountId?: string }
  return tx.accountSlug === account.slug || (!!a.accountId && tx.accountId.endsWith(a.accountId))
}

/**
 * Transactions of a year (or one month), newest first, for one account or all
 * of them. `tier` is the viewer's tier and the only one read.
 */
export function loadFinanceTransactions(tier: Tier, year: string, month?: string, account?: FinanceAccount): AugmentedTransaction[] {
  const months = month ? [month] : listMonths(year, tier)
  const rows: AugmentedTransaction[] = []
  for (const m of months) {
    const meta = readMonthlyCounterpartyMetadata(year, m, tier)
    for (const tx of readMonthlyTransactions(year, m, tier)) {
      const row = augmentTransaction(tx, meta)
      if (!account || belongsTo(row, account)) rows.push(row)
    }
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp)
}

export const isIncoming = (tx: AugmentedTransaction): boolean => tx.type === "CREDIT"

/** Amount in units of the row's currency, always positive. */
export function txAmount(tx: AugmentedTransaction): number {
  const v = typeof tx.amount === "number" ? tx.amount : typeof tx.normalizedAmount === "number" ? tx.normalizedAmount : 0
  return Math.abs(v)
}

export interface FlowTotals {
  incoming: number
  outgoing: number
  count: number
}

const emptyFlow = (): FlowTotals => ({ incoming: 0, outgoing: 0, count: 0 })

function add(flow: FlowTotals, tx: AugmentedTransaction): void {
  if (isIncoming(tx)) flow.incoming += txAmount(tx)
  else flow.outgoing += txAmount(tx)
  flow.count++
}

export function sumFlows(txs: AugmentedTransaction[]): FlowTotals {
  const flow = emptyFlow()
  for (const tx of txs) add(flow, tx)
  return flow
}

/** `YYYY-MM` → totals, newest month first. */
export function flowsByMonth(txs: AugmentedTransaction[]): Array<[string, FlowTotals]> {
  const byMonth = new Map<string, FlowTotals>()
  for (const tx of txs) {
    const d = new Date(tx.timestamp * 1000)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    add(byMonth.get(key) ?? byMonth.set(key, emptyFlow()).get(key)!, tx)
  }
  return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

/** Per configured account, in settings order, only accounts with rows. */
export function flowsByAccount(txs: AugmentedTransaction[]): Array<{ account: FinanceAccount; flow: FlowTotals }> {
  const out: Array<{ account: FinanceAccount; flow: FlowTotals }> = []
  for (const account of settings.finance.accounts) {
    const rows = txs.filter((tx) => belongsTo(tx, account))
    if (rows.length > 0) out.push({ account, flow: sumFlows(rows) })
  }
  return out
}

export interface CounterpartSummary {
  name: string
  totalIncoming: number
  totalOutgoing: number
  transactionCount: number
}

/** The name a tier gives a counterparty, or "" when that tier has none. */
export function counterpartName(tx: AugmentedTransaction): string {
  const named = typeof tx.counterparty === "string" && !tx.counterparty.startsWith("0x") ? tx.counterparty.trim() : ""
  return named || counterpartyLabel(tx.counterpartyMetadata) || (typeof tx.metadata?.fromName === "string" && isIncoming(tx) ? tx.metadata.fromName : "") || (typeof tx.metadata?.toName === "string" && !isIncoming(tx) ? tx.metadata.toName : "")
}

/**
 * Who money came from and went to, by name, largest first. Rows the tier
 * cannot name are left out, so the public tier yields nothing here.
 */
export function counterpartBreakdown(txs: AugmentedTransaction[]): { customers: CounterpartSummary[]; vendors: CounterpartSummary[] } {
  const byName = new Map<string, CounterpartSummary>()
  for (const tx of txs) {
    if (tx.rawType === "INTERNAL") continue
    const name = counterpartName(tx)
    if (!name) continue
    const entry = byName.get(name) ?? byName.set(name, { name, totalIncoming: 0, totalOutgoing: 0, transactionCount: 0 }).get(name)!
    if (isIncoming(tx)) entry.totalIncoming += txAmount(tx)
    else entry.totalOutgoing += txAmount(tx)
    entry.transactionCount++
  }
  const sorted = [...byName.values()].sort((a, b) => b.totalIncoming + b.totalOutgoing - (a.totalIncoming + a.totalOutgoing))
  // Each name on one side only: the side with the larger volume.
  return {
    customers: sorted.filter((c) => c.totalIncoming >= c.totalOutgoing && c.totalIncoming > 0),
    vendors: sorted.filter((c) => c.totalOutgoing > c.totalIncoming),
  }
}

export interface PositionedCounterpart extends CounterpartSummary {
  x: number
  y: number
  radius: number
  linkWeight: number
  side: "customer" | "vendor"
}

/** Lay customers out left and vendors right of the hub, top nine plus "Other". */
export function positionCounterparts(customers: CounterpartSummary[], vendors: CounterpartSummary[]): PositionedCounterpart[] {
  const MAX_NODES = 10
  const limit = (list: CounterpartSummary[], key: "totalIncoming" | "totalOutgoing"): CounterpartSummary[] => {
    const shown = list.slice(0, MAX_NODES - 1)
    const rest = list.slice(MAX_NODES - 1)
    if (rest.length > 0) {
      shown.push({
        name: `Other (${rest.length})`,
        totalIncoming: key === "totalIncoming" ? rest.reduce((s, c) => s + c.totalIncoming, 0) : 0,
        totalOutgoing: key === "totalOutgoing" ? rest.reduce((s, c) => s + c.totalOutgoing, 0) : 0,
        transactionCount: rest.reduce((s, c) => s + c.transactionCount, 0),
      })
    }
    return shown
  }
  const shownCustomers = limit(customers, "totalIncoming")
  const shownVendors = limit(vendors, "totalOutgoing")
  const maxAmount = Math.max(1, ...shownCustomers.map((c) => c.totalIncoming), ...shownVendors.map((v) => v.totalOutgoing))

  const place = (list: CounterpartSummary[], side: "customer" | "vendor"): PositionedCounterpart[] =>
    list.map((cp, idx) => {
      const amount = side === "customer" ? cp.totalIncoming : cp.totalOutgoing
      const useZ = list.length > 5
      const inner = side === "customer" ? 350 : 850
      const outer = side === "customer" ? 200 : 1000
      const ySpacing = useZ ? 120 : 140
      const y = useZ
        ? idx % 2 === 0
          ? 100 + (idx / 2) * ySpacing
          : 100 + Math.floor(idx / 2) * ySpacing + ySpacing / 2
        : 100 + idx * ySpacing
      return {
        ...cp,
        side,
        x: useZ && idx % 2 === 1 ? outer : inner,
        y,
        radius: 50,
        linkWeight: Math.max(1, Math.min(10, 1 + Math.sqrt(amount / maxAmount) * 9)),
      }
    })
  return [...place(shownCustomers, "customer"), ...place(shownVendors, "vendor")]
}

const withDecimals = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

/** "1,234.56 EURe" or "1,235 EURe". */
export function formatMoney(value: number, symbol: string, showDecimals = true): string {
  return `${(showDecimals ? withDecimals : whole).format(value)} ${symbol}`
}

export function monthLabel(year: string, month: string, withYear = true): string {
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString("en-US", { month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
}
