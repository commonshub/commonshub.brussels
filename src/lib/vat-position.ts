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

// ── money in and out, sorted by the VAT rate it carries ───────────────────

export type Direction = "income" | "expense"
export type RateClass = "21" | "12" | "6" | "exempt" | "outside" | "unknown"

export const RATE_CLASSES: Record<RateClass, { label: string; rate: number | null }> = {
  "21": { label: "21%", rate: 0.21 },
  "12": { label: "12%", rate: 0.12 },
  "6": { label: "6%", rate: 0.06 },
  exempt: { label: "Exempt (0%)", rate: 0 },
  outside: { label: "Outside the scope of VAT", rate: 0 },
  unknown: { label: "Not estimated", rate: null },
}
export const RATE_ORDER: RateClass[] = ["21", "12", "6", "exempt", "outside", "unknown"]

interface Rule {
  rate: RateClass
  label: string
  why: string
}

/** The VAT on each chb category of income, and why. Amounts received include the VAT. */
export const INCOME_RULES: Record<string, Rule> = {
  rental: { rate: "21", label: "Room rentals", why: "A room hired with its furniture, equipment and services is a taxable service, not the exempt letting of a building (art. 44 §3 2°)." },
  room_rental: { rate: "21", label: "Room rentals", why: "A room hired with its furniture, equipment and services is a taxable service, not the exempt letting of a building." },
  coworking: { rate: "21", label: "Coworking", why: "A desk with internet, coffee and the use of the space: a service at the standard rate." },
  ticket: { rate: "21", label: "Event tickets", why: "Admission to our talks and workshops: standard rate (the 6% rate is for cultural, sports and entertainment events, which most of ours are not)." },
  drinks: { rate: "21", label: "Drinks", why: "Drinks served on site are a catering service; drinks are always at 21% there." },
  sponsoring: { rate: "unknown", label: "Sponsoring", why: "Visibility in exchange for money is a service, taxed where the customer is: 21% for a Belgian sponsor, no Belgian VAT for a business abroad (grids 44 and 47). Most of our sponsors (Regen Village) were foreign companies, so it is not estimated." },
  catering: { rate: "12", label: "Catering", why: "Meals served: 12% on the food (drinks would be 21%)." },
  consulting: { rate: "21", label: "Consulting", why: "A service at the standard rate." },
  other_income: { rate: "21", label: "Other sales", why: "Taken as a service at the standard rate." },
  membership: { rate: "exempt", label: "Membership", why: "Fees an association collects from its members for its statutory purpose, with no individual service in exchange, are exempt (art. 44 §2 11°)." },
  donation: { rate: "outside", label: "Donations", why: "Nothing is given in exchange: not a supply, so no VAT." },
  grant: { rate: "outside", label: "Grants", why: "Funding of our activities as a whole, with nothing given in exchange to the funder: no VAT." },
  subsidy: { rate: "outside", label: "Subsidies", why: "Public funding not linked to the price of a service: no VAT." },
  debt: { rate: "outside", label: "Token top-ups", why: "Prepaid tokens are vouchers usable with many merchants: the VAT is due on what they buy when they are spent, not on the top-up." },
  "debt:eurb": {
    rate: "unknown",
    label: "EURb top-ups (drinks and coffee)",
    why: "Drinks and coffee were paid with EURb tokens bought here, so no drink sale shows in our accounts. The VAT is due when the tokens are spent at the fridge and the coffee machine; those wallets are not in the dataset for these years, so it is not estimated.",
  },
}

/** The VAT on each chb category of expense, and why. Amounts paid include the VAT. */
export const EXPENSE_RULES: Record<string, Rule> = {
  consulting: { rate: "21", label: "Consultants and freelancers", why: "Services at the standard rate. A freelancer under the €25,000 small-business threshold charges no VAT, so this is an upper bound." },
  events: { rate: "21", label: "Events", why: "Speakers, venues and services for events: standard rate." },
  services: { rate: "21", label: "Services", why: "Standard rate." },
  other_expense: { rate: "21", label: "Other expenses", why: "Taken at the standard rate." },
  equipment: { rate: "21", label: "Equipment", why: "Goods at the standard rate." },
  supplies: { rate: "21", label: "Supplies", why: "Goods at the standard rate." },
  catering: { rate: "12", label: "Catering", why: "A catering service: 12% on the food (drinks 21%)." },
  drinks: { rate: "21", label: "Drinks bought", why: "Taken at the standard rate (soft drinks and water bought in a shop can be 6%)." },
  rent: { rate: "exempt", label: "Rent", why: "Letting of a building is exempt (art. 44 §3 2°), unless the owner opted to charge VAT." },
  insurance: { rate: "exempt", label: "Insurance", why: "Insurance is exempt (art. 44 §3 4°); a separate insurance tax applies instead." },
  stripe_fee: { rate: "exempt", label: "Payment fees", why: "Payment processing is a financial service, exempt (art. 44 §3 5°)." },
  HR: { rate: "outside", label: "Social contributions", why: "Social security contributions paid through the social secretariat: not a supply." },
  salaries: { rate: "outside", label: "Salaries", why: "Wages are not a supply." },
  taxes: { rate: "outside", label: "Taxes", why: "Taxes are not a supply." },
  refund: { rate: "outside", label: "Refunds", why: "Money paid back by us, less refunds we received: not a purchase." },
  debt: { rate: "outside", label: "Tokens redeemed", why: "Paying out token balances, not a purchase." },
}

/** Not income or expenses at all: financing, and money held for someone else. */
const NOT_INCOME_OR_EXPENSE = new Set(["internal_transfer", "vat", "loan", "third_party"])

/** chb's tags spell categories with hyphens, its categories with underscores. */
const normalise = (category: string | undefined) => (category ?? "").trim().replace(/-/g, "_")

const UNKNOWN: Rule = { rate: "unknown", label: "Not categorised yet", why: "No category yet, so no rate can be applied." }

export function ruleFor(direction: Direction, category: string | undefined, collective?: string): Rule & { category: string } {
  const cat = normalise(category)
  const rules = direction === "income" ? INCOME_RULES : EXPENSE_RULES
  const key = collective && rules[`${cat}:${collective}`] ? `${cat}:${collective}` : cat
  const rule = rules[key]
  return { ...(rule ?? (cat ? { ...UNKNOWN, label: cat.replace(/_/g, " "), why: "A category without a VAT rule yet." } : UNKNOWN)), category: key }
}

const EUR = new Set(["EUR", "EURe", "EURb"])

/** Money in or out with the outside world: not a move between our own accounts, nor a VAT payment or refund. */
export function directionOf(tx: Transaction): Direction | null {
  const category = normalise(tx.metadata?.category)
  if (tx.type === "INTERNAL" || !EUR.has(tx.currency) || NOT_INCOME_OR_EXPENSE.has(category) || tx.amount === 0) return null
  // A refund we receive brings an expense down; it is not income.
  if (category === "refund") return "expense"
  return tx.amount > 0 ? "income" : "expense"
}

/** Money that came in from outside. */
export const isIncome = (tx: Transaction) => directionOf(tx) === "income"

/** VAT included in a gross amount at a rate. */
export const vatIncluded = (gross: number, rate: number) => round((gross * rate) / (1 + rate))

export interface CategoryLine {
  category: string
  label: string
  why: string
  amount: number
  vat: number | null
  count: number
}
export interface RateGroup {
  rate: RateClass
  amount: number
  vat: number | null
  lines: CategoryLine[]
}
export interface Side {
  amount: number
  /** VAT in the amounts we have a rate for. */
  vat: number
  groups: RateGroup[]
}
export interface Position {
  income: Side
  expense: Side
  /** Per quarter: the VAT our income and expenses carry. */
  quarters: Map<QuarterKey, { collected: number; paid: number }>
}

/** Brussels calendar date, as a UTC date (so getUTC* reads it back). */
function brusselsDate(timestamp: number): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(timestamp * 1000))
    .split("-")
    .map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Everything that came in and went out in these years, grouped by VAT rate
 * then category, with the VAT each amount carries. Each transaction counts
 * once, on its Brussels date.
 */
export function vatPosition(txs: Transaction[], years: number[]): Position {
  const seen = new Set<string>()
  const lines = { income: new Map<string, CategoryLine & { rate: RateClass }>(), expense: new Map<string, CategoryLine & { rate: RateClass }>() }
  const quarters = new Map<QuarterKey, { collected: number; paid: number }>()
  for (const tx of txs) {
    if (seen.has(tx.id)) continue
    seen.add(tx.id)
    const dir = directionOf(tx)
    const date = brusselsDate(tx.timestamp)
    if (!dir || !years.includes(date.getUTCFullYear())) continue
    const rule = ruleFor(dir, tx.metadata?.category, tx.metadata?.collective)
    // Expenses count positive; a refund received counts against them.
    const amount = dir === "income" ? tx.amount : -tx.amount
    const rate = RATE_CLASSES[rule.rate].rate
    const vat = rate === null ? null : vatIncluded(amount, rate)
    const line = lines[dir].get(rule.category) ?? { category: rule.category, label: rule.label, why: rule.why, rate: rule.rate, amount: 0, vat: rate === null ? null : 0, count: 0 }
    line.amount = round(line.amount + amount)
    if (vat !== null) line.vat = round((line.vat ?? 0) + vat)
    line.count++
    lines[dir].set(rule.category, line)
    if (vat) {
      const q = quarterOf(date)
      const row = quarters.get(q) ?? { collected: 0, paid: 0 }
      if (dir === "income") row.collected = round(row.collected + vat)
      else row.paid = round(row.paid + vat)
      quarters.set(q, row)
    }
  }
  const side = (m: Map<string, CategoryLine & { rate: RateClass }>): Side => {
    const groups = RATE_ORDER.map((rate) => {
      const ls = [...m.values()].filter((l) => l.rate === rate).sort((a, b) => b.amount - a.amount)
      return {
        rate,
        amount: round(ls.reduce((s, l) => s + l.amount, 0)),
        vat: RATE_CLASSES[rate].rate === null ? null : round(ls.reduce((s, l) => s + (l.vat ?? 0), 0)),
        lines: ls.map(({ rate: _rate, ...l }) => l),
      }
    }).filter((g) => g.lines.length > 0)
    return { amount: round(groups.reduce((s, g) => s + g.amount, 0)), vat: round(groups.reduce((s, g) => s + (g.vat ?? 0), 0)), groups }
  }
  return { income: side(lines.income), expense: side(lines.expense), quarters }
}

/** VAT deducted on purchases, as declared (grid 59). */
export const declaredInputVat = (period: VatPeriod) => round(period.grids["59"] ?? 0)

/** Never serve a filer's contact details, even if a published return still had them. */
export const redactDeclarant = (xml: string) => xml.replace(/<(\w+:)?(EmailAddress|Phone)>[^<]*<\/(\w+:)?\2>/g, "")
