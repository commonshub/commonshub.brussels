/**
 * The taxes the Commons Hub pays, as they show in its own bank accounts.
 *
 * Three levels of government:
 *   - local     the office tax (taxe sur les bureaux) of the City of Brussels,
 *   - regional  the property tax (précompte immobilier) of the Brussels Region,
 *               both levied on the building's owner and passed through to us
 *               for our share of the building,
 *   - federal   VAT, settled every quarter with the FPS Finance: a payment
 *               when we collected more VAT than we paid, a refund otherwise.
 *
 * Payments are recognised by their description in the public transactions
 * (settings.taxes.rules), so a new payment shows as soon as chb has it.
 * Taxes billed but not paid yet are listed in settings.taxes.pending and
 * drop off once a payment for the same tax and year appears. The VAT
 * returns themselves (what each quarter came to) are chb's vat.json.
 * Pure: the loader is in taxes-data.ts.
 */

export type TaxLevel = "local" | "regional" | "federal"
export type TaxKind = "property-tax" | "office-tax" | "vat"

export interface TaxRule {
  kind: TaxKind
  level: TaxLevel
  label: string
  localName?: string
  match: string
}

export interface TaxTransactionLike {
  id: string
  timestamp: number
  amount: number
  accountSlug?: string
  metadata?: { description?: string; category?: string | null; [key: string]: unknown }
}

export interface TaxPayment {
  id: string
  /** YYYY-MM-DD, Brussels. */
  date: string
  kind: TaxKind
  level: TaxLevel
  label: string
  /** Paid to the authorities is positive, a refund negative. */
  amount: number
  description: string
  /** For VAT: the quarter settled, "2026-Q1". */
  quarter?: string
  /** For pass-through taxes: the tax year, when the description says. */
  taxYear?: number
}

const brusselsDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })

/**
 * The VAT quarter a payment names, "2026-Q1", or null. A payment that names
 * none is not attributed: a quarter can be settled late or in parts, so
 * guessing from the date would put money against the wrong return.
 */
export function vatQuarterOf(description: string): string | null {
  const named = description.match(/\bvat (\d{4})\/q([1-4])\b/i)
  if (named) return `${named[1]}-Q${named[2]}`
  const french = description.match(/\b([1-4])\s*(?:e|er|ème)\s*trim\w*\.?\s*(\d{4})\b/i)
  if (french) return `${french[2]}-Q${french[1]}`
  return null
}

/** The tax payment this transaction is, if any. */
export function classifyTaxPayment(tx: TaxTransactionLike, rules: TaxRule[]): TaxPayment | null {
  const description = (tx.metadata?.description ?? "").trim()
  // Stripe's "Automatic Taxes" lines are Stripe's fee for its tax service, not a tax.
  if (!description || tx.metadata?.category === "stripe_fee") return null
  const rule = rules.find((r) => new RegExp(r.match, "i").test(description))
  if (!rule) return null
  const date = brusselsDate(tx.timestamp)
  const year = description.match(/\b(20\d{2})\b/)
  return {
    id: tx.id,
    date,
    kind: rule.kind,
    level: rule.level,
    label: rule.label,
    amount: Math.round(-tx.amount * 100) / 100,
    description,
    ...(rule.kind === "vat" ? { quarter: vatQuarterOf(description) ?? undefined } : year ? { taxYear: Number(year[1]) } : {}),
  }
}

/** A tax billed to us and not paid yet. */
export interface PendingTax {
  kind: TaxKind
  taxYear: number
  amount: number
}

export interface PendingItem extends PendingTax {
  level: TaxLevel
  label: string
}

export interface LevelTotal {
  level: TaxLevel
  total: number
  payments: TaxPayment[]
  pending: PendingItem[]
  pendingTotal: number
}

export interface TaxSummary {
  /** Paid so far, VAT refunds deducted. */
  total: number
  /** Paid so far plus the tax claims still to pay: the headline on /taxes. */
  totalWithPending: number
  since: string | null
  levels: LevelTotal[]
  pending: PendingItem[]
  pendingTotal: number
}

const round = (n: number) => Math.round(n * 100) / 100
export const LEVELS: TaxLevel[] = ["local", "regional", "federal"]

/** Pending bills still open: none of the payments settles the same tax for the same year. */
export function openPending(pending: PendingTax[], payments: TaxPayment[], rules: TaxRule[]): PendingItem[] {
  return pending
    .filter((bill) => !payments.some((p) => p.kind === bill.kind && p.taxYear === bill.taxYear))
    .flatMap((bill) => {
      const rule = rules.find((r) => r.kind === bill.kind)
      return rule ? [{ ...bill, level: rule.level, label: rule.label }] : []
    })
}

export function summarizeTaxes(payments: TaxPayment[], pending: PendingItem[] = []): TaxSummary {
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date))
  const levels = LEVELS.map((level) => {
    const own = sorted.filter((p) => p.level === level)
    const owed = pending.filter((b) => b.level === level).sort((a, b) => a.taxYear - b.taxYear)
    return {
      level,
      total: round(own.reduce((s, p) => s + p.amount, 0)),
      payments: own,
      pending: owed,
      pendingTotal: round(owed.reduce((s, b) => s + b.amount, 0)),
    }
  })
  const total = round(sorted.reduce((s, p) => s + p.amount, 0))
  const pendingTotal = round(pending.reduce((s, b) => s + b.amount, 0))
  return {
    total,
    totalWithPending: round(total + pendingTotal),
    since: sorted[0]?.date ?? null,
    levels,
    pending,
    pendingTotal,
  }
}

// ── VAT returns (chb's vat.json, from Intervat) ────────────────────────────

export interface VatPeriod {
  period: string
  year: number
  quarter?: number
  from: string
  to: string
  amendments: number
  grids: Record<string, number>
  totals: { outputVat: number; inputVat: number; due: number; credit: number; net: number; consistent: boolean }
}

export interface VatFile {
  generatedAt: string
  vatNumber: string
  periods: VatPeriod[]
}

const sumGrids = (grids: Record<string, number>, plus: string[], minus: string[] = []) =>
  round(plus.reduce((s, g) => s + (grids[g] ?? 0), 0) - minus.reduce((s, g) => s + (grids[g] ?? 0), 0))

/** One row of the VAT table, as chb's docs describe the overview. */
export function vatRow(period: VatPeriod) {
  return {
    period: period.period,
    label: period.quarter ? `${period.year} Q${period.quarter}` : period.period,
    sales: sumGrids(period.grids, ["00", "01", "02", "03", "44", "45", "46", "47"], ["48", "49"]),
    purchases: sumGrids(period.grids, ["81", "82", "83"], ["84", "85"]),
    outputVat: period.totals.outputVat,
    inputVat: period.totals.inputVat,
    net: period.totals.net,
    corrected: period.amendments > 0,
  }
}

// ── which payment settled which return ────────────────────────────────────

const EXPLORERS: Record<string, string> = {
  gnosis: "https://gnosisscan.io",
  celo: "https://celoscan.io",
  ethereum: "https://etherscan.io",
}

/** The public explorer page of an on-chain payment; null for a bank transfer. */
export function explorerTxUrl(id: string): string | null {
  const parts = id.split(":")
  if (parts[0] !== "ethereum" || parts[2] !== "tx" || !/^0x[0-9a-f]+$/i.test(parts[3] ?? "")) return null
  const chain = { "1": "ethereum", "100": "gnosis", "42220": "celo" }[parts[1]]
  return chain ? `${EXPLORERS[chain]}/tx/${parts[3].toLowerCase()}` : null
}

export type Settlement =
  /** Paid, or refunded, in full (to the euro). */
  | { status: "settled"; payments: TaxPayment[] }
  /** Some was paid; the rest is not in our accounts. */
  | { status: "partial"; payments: TaxPayment[]; missing: number }
  /** Nothing in our accounts: for a credit, not refunded (often carried forward). */
  | { status: "none"; payments: [] }
  /** The return came to zero. */
  | { status: "nothing-due"; payments: [] }

const quarterEnd = (period: VatPeriod) => period.to
const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000

/**
 * Match the VAT payments and refunds in the bank to the returns they settle.
 *
 * A payment belongs to a return when it names the quarter; otherwise when
 * its amount equals the return's result to the euro (a refund against a
 * credit, a payment against an amount due), after the quarter ended.
 * Failing both, a payment made within two months of a quarter's end, while
 * that return is still open, is taken as a part payment of it. Anything
 * left over is returned as unmatched: it is shown, not guessed at.
 */
export function matchVatPayments(periods: VatPeriod[], payments: TaxPayment[]): { byPeriod: Map<string, Settlement>; unmatched: TaxPayment[] } {
  const vat = payments.filter((p) => p.kind === "vat").sort((a, b) => a.date.localeCompare(b.date))
  const used = new Set<string>()
  const matched = new Map<string, TaxPayment[]>()
  const take = (period: VatPeriod, p: TaxPayment) => {
    used.add(p.id)
    matched.set(period.period, [...(matched.get(period.period) ?? []), p])
  }
  const sameSign = (net: number, p: TaxPayment) => Math.sign(net) === Math.sign(p.amount)

  // 1. Named quarter.
  for (const period of periods) for (const p of vat) if (!used.has(p.id) && p.quarter === period.period) take(period, p)
  // 2. Same amount, after the quarter ended.
  for (const period of periods) {
    if (matched.has(period.period) || period.totals.net === 0) continue
    const p = vat.find((x) => !used.has(x.id) && sameSign(period.totals.net, x) && Math.abs(Math.abs(x.amount) - Math.abs(period.totals.net)) <= 1 && x.date > quarterEnd(period))
    if (p) take(period, p)
  }
  // 3. A part payment within two months of the quarter's end.
  for (const period of periods) {
    if (matched.has(period.period) || period.totals.net <= 0) continue
    const p = vat.find((x) => !used.has(x.id) && x.amount > 0 && x.date > quarterEnd(period) && daysBetween(quarterEnd(period), x.date) <= 62)
    if (p) take(period, p)
  }

  const byPeriod = new Map<string, Settlement>()
  for (const period of periods) {
    const net = period.totals.net
    const ps = matched.get(period.period) ?? []
    if (net === 0) byPeriod.set(period.period, { status: "nothing-due", payments: [] })
    else if (ps.length === 0) byPeriod.set(period.period, { status: "none", payments: [] })
    else {
      const covered = round(ps.reduce((s, p) => s + p.amount, 0))
      const missing = round(net - covered)
      byPeriod.set(period.period, Math.abs(missing) <= 1 ? { status: "settled", payments: ps } : { status: "partial", payments: ps, missing })
    }
  }
  return { byPeriod, unmatched: vat.filter((p) => !used.has(p.id)) }
}

/** Sums for the VAT table's total row. */
export function vatTotals(rows: ReturnType<typeof vatRow>[]) {
  const sum = (key: "sales" | "purchases" | "outputVat" | "inputVat" | "net") => round(rows.reduce((s, r) => s + r[key], 0))
  return { sales: sum("sales"), purchases: sum("purchases"), outputVat: sum("outputVat"), inputVat: sum("inputVat"), net: sum("net") }
}
