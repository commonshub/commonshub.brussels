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

/** The VAT quarter a payment settles: named in the description, else the quarter before it. */
export function vatQuarterOf(description: string, date: string): string {
  const named = description.match(/\bvat (\d{4})\/q([1-4])\b/i)
  if (named) return `${named[1]}-Q${named[2]}`
  const french = description.match(/\b([1-4])\s*(?:e|er|ème)\s*trim\w*\.?\s*(\d{4})\b/i)
  if (french) return `${french[2]}-Q${french[1]}`
  const [y, m] = date.split("-").map(Number)
  const q = Math.floor((m - 1) / 3) + 1
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`
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
    ...(rule.kind === "vat" ? { quarter: vatQuarterOf(description, date) } : year ? { taxYear: Number(year[1]) } : {}),
  }
}

export interface LevelTotal {
  level: TaxLevel
  total: number
  payments: TaxPayment[]
}

export interface TaxSummary {
  total: number
  since: string | null
  levels: LevelTotal[]
  vatQuarters: Array<{ quarter: string; amount: number; payments: TaxPayment[] }>
}

const round = (n: number) => Math.round(n * 100) / 100
export const LEVELS: TaxLevel[] = ["local", "regional", "federal"]

export function summarizeTaxes(payments: TaxPayment[]): TaxSummary {
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date))
  const levels = LEVELS.map((level) => {
    const own = sorted.filter((p) => p.level === level)
    return { level, total: round(own.reduce((s, p) => s + p.amount, 0)), payments: own }
  })
  const byQuarter = new Map<string, TaxPayment[]>()
  for (const p of sorted) if (p.quarter) byQuarter.set(p.quarter, [...(byQuarter.get(p.quarter) ?? []), p])
  return {
    total: round(sorted.reduce((s, p) => s + p.amount, 0)),
    since: sorted[0]?.date ?? null,
    levels,
    vatQuarters: [...byQuarter.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([quarter, ps]) => ({ quarter, amount: round(ps.reduce((s, p) => s + p.amount, 0)), payments: ps })),
  }
}
