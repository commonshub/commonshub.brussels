/**
 * Our VAT position: what the returns say, next to what the income in our
 * accounts says we should have charged. Pure functions; the loaders are in
 * vat-position-data.ts.
 */

import type { Transaction } from "@/types/transactions"
import type { VatFile, VatPeriod } from "./taxes"
import { txPagePath } from "./tx-slug"
import { driveDocs } from "./drive-docs"
import settings from "@/settings/settings.json"

/** The day we became subject to VAT (KBO/BCE). Nothing before it carried VAT, and no return was due. */
export const VAT_REGISTERED_SINCE: string = (settings as unknown as { taxes: { vatRegisteredSince: string } }).taxes.vatRegisteredSince

/** Whether a quarter is (at least partly) after our VAT registration, so a return is due for it. */
export const subjectToVat = (year: number, quarter: number, since = VAT_REGISTERED_SINCE) => {
  const end = new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10)
  return end >= since
}

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
  if (!subjectToVat(year, quarter)) return false
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
export type RateClass = "21" | "12" | "6" | "reverse_eu" | "export" | "reverse_noneu" | "receipt" | "exempt" | "outside" | "unknown" | "before"

export const RATE_CLASSES: Record<RateClass, { label: string; rate: number | null }> = {
  "21": { label: "21%", rate: 0.21 },
  "12": { label: "12%", rate: 0.12 },
  "6": { label: "6%", rate: 0.06 },
  reverse_eu: { label: "Reverse charge: a business in another EU country", rate: 0 },
  export: { label: "0%: customers outside the EU", rate: 0 },
  reverse_noneu: { label: "Reverse charge: suppliers outside the EU", rate: 0 },
  receipt: { label: "VAT paid, not deductible", rate: 0 },
  exempt: { label: "Exempt (0%)", rate: 0 },
  outside: { label: "Outside the scope of VAT", rate: 0 },
  unknown: { label: "Not estimated", rate: null },
  before: { label: "Before our VAT registration", rate: 0 },
}
export const RATE_ORDER: RateClass[] = ["21", "12", "6", "reverse_eu", "export", "reverse_noneu", "receipt", "exempt", "outside", "unknown", "before"]

/** VAT we declare and deduct ourselves on a service bought under reverse charge (net zero), at the standard rate. */
export const SELF_ASSESSED_RATE = 0.21

/**
 * The VAT regime a payment's annotation note states, which wins over its
 * category's: "grid 44" / "EU B2B" (a business customer in another EU
 * country), "grid 47" / "outside the EU" for what we sold (no Belgian VAT),
 * "grids 88" (or 86 for goods) for a purchase from another EU country, "grid 87" for
 * one bought from outside the EU (both: reverse charge).
 */
export function regimeFromNote(dir: Direction, note: string | undefined | null): RateClass | null {
  const n = (note ?? "").toLowerCase()
  if (!n) return null
  if (dir === "income") {
    if (/grid 44|eu b2b/.test(n)) return "reverse_eu"
    if (/grid 47|outside the eu/.test(n)) return "export"
    return null
  }
  if (/grids? 8[68]|another eu country|intra-eu acquisition/.test(n)) return "reverse_eu"
  if (/grids? 87|outside the eu/.test(n)) return "reverse_noneu"
  return null
}

export const REGIME_WHY: Record<Direction, Partial<Record<RateClass, string>>> = {
  income: {
    reverse_eu: "Services to a business in another EU country: no Belgian VAT on the invoice, the customer accounts for it (grid 44).",
    export: "Services to customers outside the EU: no Belgian VAT (grid 47).",
  },
  expense: {
    reverse_eu: "Services or goods from a supplier in another EU country, invoiced without VAT: we declare the Belgian VAT ourselves (grid 88 for services, 86 for goods, and 55) and deduct it in the same return (grid 59), so it comes to nothing.",
    reverse_noneu: "Services from a supplier outside the EU, invoiced without VAT: we declare the Belgian VAT ourselves (grids 87 and 56) and deduct it in the same return (grid 59), so it comes to nothing.",
  },
}

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
  equipment: { rate: "21", label: "Equipment sold", why: "A sale of goods at the standard rate." },
  webservice: { rate: "21", label: "Web services", why: "A service at the standard rate." },
  other_income: { rate: "21", label: "Other sales", why: "Taken as a service at the standard rate." },
  membership: { rate: "exempt", label: "Membership", why: "Fees an association collects from its members for its statutory purpose, with no individual service in exchange, are exempt (art. 44 §2 11°)." },
  donation: { rate: "outside", label: "Donations", why: "Nothing is given in exchange: not a supply, so no VAT." },
  grant: { rate: "outside", label: "Grants", why: "Funding of our activities as a whole, with nothing given in exchange to the funder: no VAT." },
  subsidy: { rate: "outside", label: "Subsidies", why: "Public funding not linked to the price of a service: no VAT." },
  loan: {
    rate: "outside",
    label: "Interest-free loans (debt tokens)",
    why: "Members and supporters lent the Hub money to get started, without interest, and hold debt tokens they can redeem against the space (see /debt). A loan is financing, not a sale: outside the scope of VAT.",
  },
  debt: { rate: "outside", label: "Token top-ups", why: "Prepaid tokens are vouchers usable with many merchants: the VAT is due on what they buy when they are spent, not on the top-up." },
  "debt:eurb": {
    rate: "unknown",
    label: "EURb top-ups",
    why: "EURb tokens bought by card. The VAT is due on what they buy when they are spent, and what they bought in these years is not known yet, so it is not estimated.",
  },
}

/** The VAT on each chb category of expense, and why. Amounts paid include the VAT. */
export const EXPENSE_RULES: Record<string, Rule> = {
  consulting: { rate: "21", label: "Consultants and freelancers", why: "Services at the standard rate. Freelancers based in another EU country invoice us without VAT: we then owe the Belgian VAT ourselves (reverse charge) and deduct it in the same return, so for them it comes to nothing." },
  events: { rate: "21", label: "Events", why: "Speakers, venues and services for events: standard rate." },
  services: { rate: "21", label: "Services", why: "Standard rate." },
  other_expense: { rate: "21", label: "Other expenses", why: "Taken at the standard rate." },
  equipment: { rate: "21", label: "Equipment", why: "Goods at the standard rate." },
  supplies: { rate: "21", label: "Supplies", why: "Goods at the standard rate." },
  catering: { rate: "12", label: "Catering", why: "Meals and catering: 12% on the food served (food bought in a shop is 6%, drinks 21%)." },
  webservice: { rate: "21", label: "Software and web services", why: "Standard rate. Most are billed from abroad: we then declare the Belgian VAT ourselves (reverse charge) and deduct it in the same return." },
  fridge: { rate: "6", label: "Fridge stock", why: "Food and soft drinks bought for the fridge: 6% (beer and other alcohol would be 21%)." },
  donation: { rate: "outside", label: "Donations we made", why: "Nothing received in exchange: not a purchase." },
  drinks: { rate: "21", label: "Drinks bought", why: "Taken at the standard rate (soft drinks and water bought in a shop can be 6%)." },
  travel: {
    rate: "receipt",
    label: "Travel",
    why: "International train tickets carry no VAT, and VAT paid abroad (a hotel, an Airbnb) cannot be deducted in a Belgian return.",
  },
  marketing: { rate: "21", label: "Printing and merchandise", why: "Printing, stickers, labels and merchandise: standard rate." },
  accounting: { rate: "21", label: "Accounting and legal", why: "Services at the standard rate." },
  furniture: { rate: "21", label: "Furniture", why: "Goods at the standard rate." },
  maintenance: { rate: "21", label: "Maintenance", why: "DIY materials and repairs: standard rate." },
  utilities: { rate: "21", label: "Utilities", why: "Energy and water bills: standard rate (6% for water)." },
  internet: { rate: "21", label: "Telecommunications", why: "Standard rate." },
  coffee: { rate: "6", label: "Coffee", why: "Coffee beans and food bought in a shop: 6%." },
  bank_fees: { rate: "exempt", label: "Bank fees", why: "Banking services are exempt (art. 44 §3 5°)." },
  donations_given: { rate: "outside", label: "Donations we made", why: "Nothing received in exchange: not a purchase." },
  reimbursement: {
    rate: "receipt",
    label: "Expenses reimbursed",
    why: "What volunteers and the team bought for the Hub (groceries, consumables…) and we paid back. They paid the VAT, but on a receipt, not an invoice in our name, so we cannot deduct it.",
  },
  expense: {
    rate: "receipt",
    label: "Expenses reimbursed",
    why: "What volunteers and the team bought for the Hub (groceries, consumables…) and we paid back. They paid the VAT, but on a receipt, not an invoice in our name, so we cannot deduct it.",
  },
  expense_reimbursement: {
    rate: "receipt",
    label: "Expenses reimbursed",
    why: "What volunteers and the team bought for the Hub (groceries, consumables…) and we paid back. They paid the VAT, but on a receipt, not an invoice in our name, so we cannot deduct it.",
  },
  rent: { rate: "exempt", label: "Rent", why: "Letting of a building is exempt (art. 44 §3 2°), unless the owner opted to charge VAT." },
  insurance: { rate: "exempt", label: "Insurance", why: "Insurance is exempt (art. 44 §3 4°); a separate insurance tax applies instead." },
  stripe_fee: { rate: "exempt", label: "Payment fees", why: "Payment processing is a financial service, exempt (art. 44 §3 5°)." },
  HR: { rate: "outside", label: "Social contributions", why: "Social security contributions paid through the social secretariat: not a supply." },
  salaries: { rate: "outside", label: "Salaries", why: "Wages are not a supply." },
  taxes: { rate: "outside", label: "Taxes", why: "Taxes are not a supply." },
  loan: { rate: "outside", label: "Loans repaid", why: "Paying back a loan is not a purchase: outside the scope of VAT." },
  refund: { rate: "outside", label: "Refunds", why: "Money paid back by us, less refunds we received: not a purchase." },
  debt: { rate: "outside", label: "Tokens redeemed", why: "Paying out token balances, not a purchase." },
}

/** Not money of ours coming or going: moves between our accounts, VAT settlements, money held for someone else. */
const NOT_INCOME_OR_EXPENSE = new Set(["internal_transfer", "vat", "third_party"])

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
const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

/**
 * One movement of money. A blockchain transaction can carry several
 * transfers (a swap paying out three amounts) under the same id, so the id
 * alone would merge them; the same row read twice still counts once.
 */
export const txKey = (tx: Pick<Transaction, "id" | "accountSlug" | "counterpartyId" | "amount">) => `${tx.id}|${tx.accountSlug}|${tx.counterpartyId ?? ""}|${tx.amount}`

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

/** A payment large enough to be justified one by one. */
/** Several transactions that are one thing (a grant paid in tranches), shown as one line with its supporting document. */
export interface PaymentGroup {
  id: string
  label: string
  /** One line of context: "48,000 cUSD paid in tranches". */
  detail?: string
  document?: { label: string; url: string; labelFr?: string }
  /** French, for the page in French. */
  labelFr?: string
  detailFr?: string
  /** The transactions it is made of (every transfer of each). */
  txs: string[]
}

export const PAYMENT_GROUPS: PaymentGroup[] = (settings as unknown as { taxes: { paymentGroups?: PaymentGroup[] } }).taxes.paymentGroups ?? []

export interface Item {
  date: string
  amount: number
  /** How many transactions it stands for (more than one for a group). */
  count?: number
  /** Set when the item is a group: its name, context, document, and the last date. */
  group?: { label: string; detail?: string; labelFr?: string; detailFr?: string; document?: { label: string; url: string; labelFr?: string }; until: string }
  description: string
  note: string
  collective: string
  /** Its own page: where to check and annotate it. */
  href: string
  /** Its page on a blockchain explorer, when it is on chain. */
  explorer: string | null
  /** Its invoice or receipt in the Accounting Drive, when known. */
  docs?: string[]
}

export interface CategoryLine {
  category: string
  label: string
  why: string
  amount: number
  vat: number | null
  count: number
  /** Payments of at least LARGE, biggest first. */
  items: Item[]
  /** For "smaller amounts": the categories put together. */
  parts?: Array<{ category: string; label: string; amount: number }>
  /** Totals per project (collective slug, "" when none), over every payment of the line. */
  projects: Record<string, { amount: number; count: number }>
}

/** A payment from this amount up is listed one by one. */
export const LARGE = 2000
/**
 * "2 payments of €20k or more": the smallest one listed, rounded down to the
 * thousand, says more than the threshold. A single one gives its amount.
 */
export function itemsLabel(amounts: number[]): string {
  if (amounts.length === 0) return ""
  if (amounts.length === 1) return `1 payment of €${Math.round(amounts[0]).toLocaleString("en-GB")}`
  const floor = Math.floor(Math.min(...amounts) / 1000)
  return `${amounts.length} payments of €${floor}k or more`
}

/** A category under this total joins the "smaller amounts" of its rate. */
export const SMALL_CATEGORY = 1000

/** The month folder a transaction is filed under: chb files by UTC date, which can differ from Brussels around midnight. */
const monthOfFile = (tx: Transaction, brusselsIso: string) => {
  const utc = new Date(tx.timestamp * 1000).toISOString().slice(0, 10)
  return utc.slice(0, 7) === brusselsIso.slice(0, 7) ? brusselsIso : utc
}

export function itemOf(tx: Transaction, date: Date, explorer: (id: string) => string | null): Item {
  const iso = date.toISOString().slice(0, 10)
  const abs = Math.abs(tx.amount)
  const onChain = explorer(tx.id)
  const meta = (tx.metadata ?? {}) as Record<string, unknown>
  return {
    date: iso,
    amount: round(abs),
    description: String(meta.description ?? "").trim(),
    note: String(meta.note ?? "").trim(),
    collective: String(meta.collective ?? ""),
    href: txPagePath(tx.id, monthOfFile(tx, iso)),
    explorer: onChain,
    docs: driveDocs(tx.id, tx.amount),
  }
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
/** One category's total over every rate it falls under (before and after our VAT registration). */
export interface CategoryTotal {
  category: string
  label: string
  /** VAT included. */
  amount: number
  /** VAT in it; 0 where no rate is estimated. */
  vat: number
  count: number
  /** Payments of at least LARGE. */
  items: Item[]
}

export interface Position {
  income: Side
  expense: Side
  /** Per quarter: the VAT our income and expenses carry. */
  quarters: Map<QuarterKey, { collected: number; paid: number }>
  /** The same money by category alone, for comparing with books kept by category (WinBooks). */
  byCategory: Record<Direction, Map<string, CategoryTotal>>
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
export function vatPosition(txs: Transaction[], years: number[], explorer: (id: string) => string | null = () => null, groups: PaymentGroup[] = PAYMENT_GROUPS): Position {
  const seen = new Set<string>()
  const groupOf = new Map(groups.flatMap((g) => g.txs.map((id) => [id, g] as const)))
  // Per category line, the group items being built.
  const grouped = new Map<string, Map<string, Item>>()
  const lines = { income: new Map<string, CategoryLine & { rate: RateClass }>(), expense: new Map<string, CategoryLine & { rate: RateClass }>() }
  const quarters = new Map<QuarterKey, { collected: number; paid: number }>()
  const byCategory: Position["byCategory"] = { income: new Map(), expense: new Map() }
  for (const tx of txs) {
    const key = txKey(tx)
    if (seen.has(key)) continue
    seen.add(key)
    const dir = directionOf(tx)
    const date = brusselsDate(tx.timestamp)
    // €1 test transfers (before a real payment, or to try a wallet) are noise here.
    if (!dir || !years.includes(date.getUTCFullYear()) || Math.abs(tx.amount) <= 1) continue
    const category0 = ruleFor(dir, tx.metadata?.category, tx.metadata?.collective)
    // The annotation's VAT regime (a sponsor abroad, a supplier billing under reverse charge) wins over the category's.
    const regime = regimeFromNote(dir, String((tx.metadata as Record<string, unknown>)?.note ?? ""))
    const base = regime ? { ...category0, rate: regime, why: REGIME_WHY[dir][regime] ?? category0.why } : category0
    // Before we were registered, nothing carried VAT and none could be deducted. That only
    // changes something for what would carry VAT: donations or rent are the same either way.
    const taxable = ["21", "12", "6", "receipt"].includes(base.rate)
    const rule = taxable && date.toISOString().slice(0, 10) < VAT_REGISTERED_SINCE
      ? { ...base, rate: "before" as RateClass, why: `Before ${longDay(VAT_REGISTERED_SINCE)}, when we became subject to VAT: no VAT charged, none deducted.` }
      : base
    // Expenses count positive; a refund received counts against them.
    const amount = dir === "income" ? tx.amount : -tx.amount
    const rate = RATE_CLASSES[rule.rate].rate
    const vat = rate === null ? null : vatIncluded(amount, rate)
    const lineKey = `${rule.rate}|${rule.category}`
    const line = lines[dir].get(lineKey) ?? { category: rule.category, label: rule.label, why: rule.why, rate: rule.rate, amount: 0, vat: rate === null ? null : 0, count: 0, items: [], projects: {} }
    const project = String(tx.metadata?.collective ?? "")
    const pt = line.projects[project] ?? { amount: 0, count: 0 }
    line.projects[project] = { amount: round(pt.amount + amount), count: pt.count + 1 }
    line.amount = round(line.amount + amount)
    const group = groupOf.get(tx.id)
    if (group) {
      const byGroup = grouped.get(`${dir}|${lineKey}`) ?? new Map<string, Item>()
      const iso = date.toISOString().slice(0, 10)
      const g = byGroup.get(group.id)
      if (!g) {
        byGroup.set(group.id, {
          ...itemOf(tx, date, explorer),
          amount: round(Math.abs(tx.amount)),
          count: 1,
          group: { label: group.label, detail: group.detail, labelFr: group.labelFr, detailFr: group.detailFr, document: group.document, until: iso },
        })
      } else {
        g.amount = round(g.amount + Math.abs(tx.amount))
        g.count = (g.count ?? 1) + 1
        g.docs = [...new Set([...(g.docs ?? []), ...driveDocs(tx.id, tx.amount)])]
        if (iso < g.date) Object.assign(g, { date: iso, href: itemOf(tx, date, explorer).href })
        if (iso > g.group!.until) g.group!.until = iso
      }
      grouped.set(`${dir}|${lineKey}`, byGroup)
    } else if (Math.abs(tx.amount) >= LARGE) line.items.push(itemOf(tx, date, explorer))
    if (vat !== null) line.vat = round((line.vat ?? 0) + vat)
    line.count++
    lines[dir].set(lineKey, line)
    const total = byCategory[dir].get(base.category) ?? { category: base.category, label: base.label, amount: 0, vat: 0, count: 0, items: [] }
    total.amount = round(total.amount + amount)
    total.vat = round(total.vat + (vat ?? 0))
    total.count++
    if (Math.abs(tx.amount) >= LARGE) total.items.push(itemOf(tx, date, explorer))
    byCategory[dir].set(base.category, total)
    if (vat) {
      const q = quarterOf(date)
      const row = quarters.get(q) ?? { collected: 0, paid: 0 }
      if (dir === "income") row.collected = round(row.collected + vat)
      else row.paid = round(row.paid + vat)
      quarters.set(q, row)
    }
  }
  for (const [key, byGroup] of grouped) {
    const [dir, lineKey] = [key.slice(0, key.indexOf("|")), key.slice(key.indexOf("|") + 1)] as [Direction, string]
    lines[dir].get(lineKey)?.items.push(...byGroup.values())
  }
  const side = (m: Map<string, CategoryLine & { rate: RateClass }>): Side => {
    const groups = RATE_ORDER.map((rate) => {
      const all = [...m.values()].filter((l) => l.rate === rate)
      const big = all.filter((l) => Math.abs(l.amount) >= SMALL_CATEGORY)
      const small = all.filter((l) => Math.abs(l.amount) < SMALL_CATEGORY)
      // Categories too small to matter are put together, each still named.
      const merged =
        small.length > 1
          ? [
              {
                category: `small:${rate}`,
                label: "Smaller amounts",
                why: small
                  .sort((a, b) => b.amount - a.amount)
                  .map((l) => `${l.label} (€${Math.round(l.amount).toLocaleString("en-GB")})`)
                  .join(", "),
                rate,
                amount: round(small.reduce((s, l) => s + l.amount, 0)),
                vat: RATE_CLASSES[rate].rate === null ? null : round(small.reduce((s, l) => s + (l.vat ?? 0), 0)),
                count: small.reduce((s, l) => s + l.count, 0),
                items: small.flatMap((l) => l.items),
                parts: small.map((l) => ({ category: l.category, label: l.label, amount: l.amount })),
                projects: small.reduce<Record<string, { amount: number; count: number }>>((acc, l) => {
                  for (const [k, v] of Object.entries(l.projects)) acc[k] = { amount: round((acc[k]?.amount ?? 0) + v.amount), count: (acc[k]?.count ?? 0) + v.count }
                  return acc
                }, {}),
              },
            ]
          : small
      const ls = [...big, ...merged].sort((a, b) => b.amount - a.amount).map((l) => ({ ...l, items: [...l.items].sort((a, b) => b.amount - a.amount) }))
      return {
        rate,
        amount: round(ls.reduce((s, l) => s + l.amount, 0)),
        vat: RATE_CLASSES[rate].rate === null ? null : round(ls.reduce((s, l) => s + (l.vat ?? 0), 0)),
        lines: ls.map(({ rate: _rate, ...l }) => l),
      }
    }).filter((g) => g.lines.length > 0)
    return { amount: round(groups.reduce((s, g) => s + g.amount, 0)), vat: round(groups.reduce((s, g) => s + (g.vat ?? 0), 0)), groups }
  }
  return { income: side(lines.income), expense: side(lines.expense), quarters, byCategory }
}

/** VAT deducted on purchases, as declared (grid 59). */
export const declaredInputVat = (period: VatPeriod) => round(period.grids["59"] ?? 0)

/** Never serve a filer's contact details, even if a published return still had them. */
export const redactDeclarant = (xml: string) => xml.replace(/<(\w+:)?(EmailAddress|Phone)>[^<]*<\/(\w+:)?\2>/g, "")
