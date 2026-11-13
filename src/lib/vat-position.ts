/**
 * Our VAT position: what the returns say, next to what the income in our
 * accounts says we should have charged. Pure functions; the loaders are in
 * vat-position-data.ts.
 */

import type { Transaction } from "@/types/transactions"
import type { VatFile, VatPeriod } from "./taxes"

const round = (n: number) => Math.round(n * 100) / 100

// ── quarters ──────────────────────────────────────────────────────────────

export type QuarterKey = `${number}-Q${1 | 2 | 3 | 4}`

export const quarterKey = (year: number, quarter: number) => `${year}-Q${quarter}` as QuarterKey
export const quarterOf = (date: Date) => quarterKey(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) + 1)
/** Last month of a quarter, as the dataset's folders name it ("06" for Q2). */
export const quarterLastMonth = (quarter: number) => String(quarter * 3).padStart(2, "0")

/**
 * A return is filed in the month after its quarter ends. A quarter counts
 * as missing once that month is over and no return is on file.
 */
export function returnOverdue(year: number, quarter: number, now = new Date()): boolean {
  const deadline = Date.UTC(year, quarter * 3 + 1, 1) // first day of the second month after the quarter
  return now.getTime() >= deadline
}

/** The period's latest filing and any it replaced, newest first. */
export function filingsOf(period: VatPeriod) {
  const filings = (period as VatPeriod & { filings?: Array<{ statementId: string; superseded: boolean; sequenceNumber?: string }> }).filings ?? []
  return [...filings].sort((a, b) => Number(a.superseded) - Number(b.superseded))
}

export function findPeriod(vat: VatFile | null, year: number, quarter: number): VatPeriod | null {
  return vat?.periods.find((p) => p.year === year && p.quarter === quarter) ?? null
}

/** VAT charged on our sales, as declared: grid 54, less the VAT on credit notes we issued (grid 64). */
export const declaredSalesVat = (period: VatPeriod) => round((period.grids["54"] ?? 0) - (period.grids["64"] ?? 0))

// ── income, sorted the way the VAT sees it ────────────────────────────────

export type IncomeBucket = "rentals" | "coworking" | "membership" | "donations" | "drinks" | "tickets" | "other"

export interface BucketInfo {
  label: string
  /** The VAT rate we expect on it, VAT included in the amount received; null when not estimated. */
  rate: number | null
  why: string
}

export const BUCKETS: Record<IncomeBucket, BucketInfo> = {
  rentals: { label: "Room rentals", rate: 0.21, why: "Renting a room with its equipment and services: 21%." },
  coworking: { label: "Coworking", rate: 0.21, why: "A desk with services: 21%." },
  tickets: { label: "Event tickets", rate: 0.21, why: "Admission to our events, taken at 21%." },
  drinks: { label: "Drinks", rate: 0.21, why: "Drinks served on site: 21%." },
  membership: { label: "Membership", rate: 0, why: "Member contributions, with nothing sold in exchange: no VAT." },
  donations: { label: "Donations, grants & subsidies", rate: 0, why: "No goods or services in exchange: outside the scope of VAT." },
  other: { label: "Other income", rate: null, why: "Not estimated: see the breakdown." },
}

export const BUCKET_ORDER: IncomeBucket[] = ["rentals", "coworking", "tickets", "drinks", "membership", "donations", "other"]

const CATEGORY_BUCKET: Record<string, IncomeBucket> = {
  rental: "rentals",
  room_rental: "rentals",
  coworking: "coworking",
  membership: "membership",
  donation: "donations",
  grant: "donations",
  subsidy: "donations",
  drinks: "drinks",
  ticket: "tickets",
}

/** How the "other" income is labelled, by chb category. */
export const OTHER_LABELS: Record<string, string> = {
  "": "Not categorised yet",
  debt: "Token top-ups",
  sponsoring: "Sponsoring",
  consulting: "Consulting",
  refund: "Refunds",
}

export const bucketOf = (category: string | undefined): IncomeBucket => CATEGORY_BUCKET[category ?? ""] ?? "other"

const EUR = new Set(["EUR", "EURe", "EURb"])

/** Money that came in from outside: not a move between our own accounts. */
export function isIncome(tx: Transaction): boolean {
  return tx.amount > 0 && tx.type !== "INTERNAL" && EUR.has(tx.currency) && tx.metadata?.category !== "internal_transfer"
}

/** VAT included in a gross amount at a rate. */
export const vatIncluded = (gross: number, rate: number) => round((gross * rate) / (1 + rate))

export interface QuarterIncome {
  quarter: QuarterKey
  byBucket: Record<IncomeBucket, number>
  /** The "other" bucket, by chb category ("" = uncategorised). */
  other: Record<string, number>
  total: number
}

const emptyBuckets = () => Object.fromEntries(BUCKET_ORDER.map((b) => [b, 0])) as Record<IncomeBucket, number>

/** Income per quarter and bucket. Each transaction counts once, on its Brussels date. */
export function incomeByQuarter(txs: Transaction[]): Map<QuarterKey, QuarterIncome> {
  const out = new Map<QuarterKey, QuarterIncome>()
  const seen = new Set<string>()
  for (const tx of txs) {
    if (seen.has(tx.id) || !isIncome(tx)) continue
    seen.add(tx.id)
    const q = quarterOf(brusselsDate(tx.timestamp))
    const row = out.get(q) ?? { quarter: q, byBucket: emptyBuckets(), other: {}, total: 0 }
    const bucket = bucketOf(tx.metadata?.category)
    row.byBucket[bucket] = round(row.byBucket[bucket] + tx.amount)
    if (bucket === "other") {
      const cat = tx.metadata?.category ?? ""
      row.other[cat] = round((row.other[cat] ?? 0) + tx.amount)
    }
    row.total = round(row.total + tx.amount)
    out.set(q, row)
  }
  return out
}

/** The calendar date in Brussels, as a UTC date (so getUTC* reads it back). */
function brusselsDate(timestamp: number): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(timestamp * 1000))
    .split("-")
    .map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** VAT we should have charged on a quarter's income, from the rates above. */
export function expectedSalesVat(income: QuarterIncome | undefined): number {
  if (!income) return 0
  return round(BUCKET_ORDER.reduce((s, b) => s + (BUCKETS[b].rate ? vatIncluded(income.byBucket[b], BUCKETS[b].rate!) : 0), 0))
}

/** Never serve a filer's contact details, even if a published return still had them. */
export const redactDeclarant = (xml: string) => xml.replace(/<(\w+:)?(EmailAddress|Phone)>[^<]*<\/(\w+:)?\2>/g, "")
