/**
 * The expenses a visitor can take on, read from the Odoo vendor bills that
 * the chb pipeline exports under DATA_DIR.
 *
 * Two kinds:
 *
 *   - recurring: rent, furniture, internet, electricity… Named in
 *     settings.json, matched by vendor name or by what the bill line says
 *     (and, for rent, by title, since the landlord also sends other
 *     invoices). The amount shown is what a month of it costs, read from the
 *     most recent bills.
 *   - one-time: every other posted bill of the last year, minus catering —
 *     food and drinks are bought for a day and gone, there is nothing left in
 *     the space to point at.
 *
 * Bills that only carry a category on 1 in 10 rows cannot be classified by
 * category, so everything here goes by vendor name and line text. Vendor
 * names live in the private half of the export, which the public site may
 * not receive at all; the line text is in the public half, so every rule
 * also matches on that. Individuals are never named: a bill from a person
 * shows as "Individual supplier", as on the quarterly reports.
 */

import * as fs from "fs"
import * as path from "path"
import { DATA_DIR } from "./data-paths"
import settings from "@/settings/settings.json"
import { contributionMessage } from "./contribute"

export type ExpenseKind = "recurring" | "one-time"

export interface ContributableExpense {
  slug: string
  kind: ExpenseKind
  label: string
  /** Company name, or "Individual supplier" for a person. */
  vendor: string
  /** A month of it for recurring expenses; the bill total otherwise. */
  amountEur: number
  /** Latest bill date, ISO. */
  date: string
  /** The bill number for a one-time expense; the slug for a recurring one. */
  reference: string
  description?: string
  /** What the bill lists, for a one-time expense. */
  lines: string[]
  /** How many bills the recurring amount was read from. */
  billCount: number
  /** The transfer message that ties a payment to this expense. */
  message: string
  /** For a cost billed once a year: the yearly amount; amountEur is a twelfth of it. */
  annualAmount?: number
  /** A short name for running text: "phone booth", "rent". */
  short?: string
  /** For a bill still to pay: when it is due, ISO, and whether that is past. */
  dueDate?: string
  overdue?: boolean
  /**
   * The expense's identifier on Nostr (NIP-73 style, the `i` tag of its
   * annotations and the `I` tag of comments on it): `chb:expense:<slug>` for
   * a recurring cost, `chb:bill:<chb public id>` for a bill.
   */
  uri: string
  /** chb's stable public id of the bill (`b-…`), for a bill. */
  publicId?: string
  /** The bill's category in the books, when there is one. */
  category?: string | null
}

export interface ContributeExpenses {
  recurring: ContributableExpense[]
  /** Bills still to pay, most urgent first (chb's pending-bills.json). */
  oneTime: ContributableExpense[]
  /** True when the dataset had no Odoo bills at all in the window. */
  empty: boolean
  /** What is still owed, as chb totals it; null before chb publishes the list. */
  pending: PendingSummary | null
}

export interface PendingSummary {
  generatedAt: string
  count: number
  amountDue: number
  /** Bills in another currency than EUR: listed in their currency, not coverable here. */
  otherCurrencies: Array<{ currency: string; count: number; amountDue: number }>
}

// ── raw records, as chb writes them ──────────────────────────────────────

interface PublicLineItem {
  title?: string
  displayType?: string
  totalAmount?: number
}

interface PublicBill {
  id: number
  title?: string
  moveType?: string
  state: string
  date: string
  totalAmount?: number
  category?: string | null
  lineItems?: PublicLineItem[]
}

/** A bill as chb ≥ 3.14 writes it (docs/bills.md). */
export interface ChbBill {
  id: string
  number: string
  type: "bill" | "credit_note"
  status: "pending" | "partially_paid" | "paid" | "reversed"
  date: string
  dueDate?: string
  vendor: { type: "business" | "individual"; name?: string; vat?: string }
  vendorRef?: string
  description?: string
  lines?: Array<{ description?: string; totalAmount?: number }>
  category?: string | null
  currency: string
  totalAmount: number
  amountDue: number
}

interface PrivateBill {
  id: number
  moveType?: string
  ref?: string
  reference?: string
  number?: string
  partner?: { id?: number; name?: string; displayName?: string; isCompany?: boolean; companyType?: string }
  partnerDisplayName?: string
}

export interface Bill {
  id: number | string
  title: string
  date: string
  state: string
  refund: boolean
  totalAmount: number
  category: string | null
  vendor: string
  vendorIsCompany: boolean
  /** The name as it appears in the books, for matching rules only. */
  vendorName: string
  reference: string
  lines: string[]
}

interface RecurringRule {
  slug: string
  label: string
  /** Vendor name, regex — needs the private export. */
  vendor?: string
  /** Bill line text, regex — works from the public export alone. */
  line?: string
  /** Extra condition on the bill/line text, for vendors that bill other things too. */
  title?: string
  description?: string
  monthlyAmount?: number
  /** A yearly bill (the taxes): shown as a twelfth of it per month. */
  annualAmount?: number
  /** What the transfer message calls it: "Contribution <short>". */
  short?: string
  /** The suppliers, as the page names them, when a cost has several. */
  vendorLabel?: string
  /** Older slugs of this cost; their pages redirect here. */
  aliases?: string[]
  /** false for a cost paid under a contract rather than billed (the rent): bills are never matched to it. */
  billed?: boolean
}

interface ContributeSettings {
  recurring: RecurringRule[]
  exclude: { vendor?: string; categories?: string[]; title?: string }
  oneTimeMonths: number
  /** One-time bills under this are bank fees and rounding, not expenses. */
  oneTimeMinAmount?: number
}

const CONFIG = settings.contribute as unknown as ContributeSettings

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch (error) {
    console.error(`[contribute] could not parse ${filePath}:`, error)
    return null
  }
}

/** "[103062072388] Business Internet Mega Fiber" → "Business Internet Mega Fiber" */
function cleanLine(title: string): string {
  return title.replace(/^\[[^\]]*\]\s*/, "").replace(/\s+/g, " ").trim()
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * A person who bought something for the space and was reimbursed often has
 * their own name in the bill line ("Jane Doe: batteries"). The partner is
 * already hidden behind "Individual supplier"; the line must not undo that.
 */
export function withoutPersonName(line: string, personName: string): string {
  const tokens = personName.split(/\s+/).filter((token) => token.length >= 3)
  if (tokens.length === 0) return line
  const pattern = new RegExp(`\\b(?:${tokens.map(escapeRegex).join("|")})\\b`, "gi")
  return line
    .replace(pattern, "")
    // "Contact: Someone." names a person who is not the vendor either.
    .replace(/\bcontact\s*:\s*[^.,;]+[.,;]?/gi, "")
    .replace(/^[\s:.,;\-–—]+|[\s:.,;\-–—]+$/g, "")
    .replace(/\s+([:,.;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/** "CHB-S/2026/09/0011" → "chb-s-2026-09-0011": the bill's page, named after our accounting reference. */
export function billSlug(reference: string): string {
  return reference
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const expenseUri = (slug: string) => `chb:expense:${slug}`
export const billUri = (publicId: string) => `chb:bill:${publicId}`

const isChbBill = (record: object): record is ChbBill => "status" in record && typeof (record as ChbBill).vendor === "object"

/** A chb ≥ 3.14 bill in the shape the matching rules read. */
function fromChbBill(record: ChbBill): Bill {
  const business = record.vendor?.type === "business"
  const name = record.vendor?.name ?? ""
  const lines = (record.lines ?? []).map((line) => cleanLine(line.description ?? "")).filter(Boolean)
  return {
    id: record.id,
    title: record.description ? cleanLine(record.description) : "",
    date: record.date,
    // chb publishes posted bills only; "reversed" ones were cancelled.
    state: record.status === "reversed" ? "cancel" : "posted",
    refund: record.type === "credit_note",
    totalAmount: record.totalAmount ?? 0,
    category: record.category ?? null,
    vendor: business ? name : "Individual supplier",
    vendorIsCompany: business,
    vendorName: name,
    reference: record.number || record.vendorRef || record.id,
    lines: business || !name ? lines : lines.map((line) => withoutPersonName(line, name)),
  }
}

/**
 * One month of vendor bills, from chb's public-tier projection
 * (`YYYY/MM/public/bills.json`). Business vendors are named, private
 * individuals are not. The provider archive under providers/ is never read.
 * Reads chb ≥ 3.14's schema (docs/bills.md) and the earlier one.
 */
export function readMonthBills(dataDir: string, year: string, month: string): Bill[] | null {
  const pub = readJson<{ bills: Array<(PublicBill & Partial<PrivateBill>) | ChbBill> }>(path.join(dataDir, year, month, "public", "bills.json"))
  if (!pub) return null

  const bills: Bill[] = []
  for (const record of pub.bills) {
    if (isChbBill(record)) {
      bills.push(fromChbBill(record))
      continue
    }
    const priv = record.partner || record.partnerDisplayName ? (record as PrivateBill) : undefined
    const partner = priv?.partner ?? {}
    const isCompany = partner.companyType === "company" || partner.isCompany === true
    const name = partner.displayName || partner.name || priv?.partnerDisplayName || ""
    const moveType = priv?.moveType || record.moveType || "in_invoice"
    bills.push({
      id: record.id,
      title: record.title || "",
      date: record.date,
      state: record.state,
      refund: moveType === "in_refund",
      totalAmount: record.totalAmount ?? 0,
      category: record.category ?? null,
      vendor: !priv ? "" : isCompany ? name : "Individual supplier",
      vendorIsCompany: isCompany,
      vendorName: name,
      reference: priv?.number || priv?.ref || priv?.reference || record.title || `#${record.id}`,
      lines: (record.lineItems ?? [])
        .filter((line) => !line.displayType || line.displayType === "product")
        .map((line) => cleanLine(line.title ?? ""))
        .map((line) => (isCompany || !name ? line : withoutPersonName(line, name)))
        .filter(Boolean),
    })
  }
  return bills
}

/**
 * The bills still to pay (`latest/public/pending-bills.json`, chb ≥ 3.14),
 * as expenses anyone can chip in for: EUR bills with something left to pay,
 * overdue first, then by due date. Covering one is a donation to the Hub
 * earmarked for that bill, quoted by its number; stewards then pay the
 * vendor. Bills in another currency are summed apart and not offered.
 */
export function readPendingBills(dataDir: string, now: Date = new Date()): { expenses: ContributableExpense[]; summary: PendingSummary } | null {
  const file = readJson<{ generatedAt: string; bills: ChbBill[] }>(path.join(dataDir, "latest", "public", "pending-bills.json"))
  if (!file) return null
  const today = now.toISOString().slice(0, 10)
  const open = file.bills.filter((b) => b.type === "bill" && b.status !== "reversed" && b.amountDue > 0)
  const eur = open.filter((b) => b.currency === "EUR")

  const expenses = eur
    .map((record): ContributableExpense => {
      const bill = fromChbBill(record)
      const label = bill.title || bill.lines[0] || `${bill.vendor || "Bill"} ${bill.reference}`
      return {
        slug: billSlug(record.number || record.id),
        uri: billUri(record.id),
        publicId: record.id,
        category: record.category ?? null,
        kind: "one-time",
        label: label.length > 80 ? `${label.slice(0, 79).trimEnd()}…` : label,
        vendor: bill.vendor || "Individual supplier",
        amountEur: record.amountDue,
        date: record.date,
        reference: bill.reference,
        lines: bill.lines,
        billCount: 1,
        message: contributionMessage(bill.reference),
        ...(record.dueDate ? { dueDate: record.dueDate, overdue: record.dueDate < today } : {}),
      }
    })
    .sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue) || (a.dueDate ?? a.date).localeCompare(b.dueDate ?? b.date))

  const others = new Map<string, { count: number; amountDue: number }>()
  for (const b of open.filter((b) => b.currency !== "EUR")) {
    const entry = others.get(b.currency) ?? { count: 0, amountDue: 0 }
    entry.count++
    entry.amountDue = Math.round((entry.amountDue + b.amountDue) * 100) / 100
    others.set(b.currency, entry)
  }
  return {
    expenses,
    summary: {
      generatedAt: file.generatedAt,
      count: expenses.length,
      amountDue: Math.round(expenses.reduce((s, e) => s + e.amountEur, 0) * 100) / 100,
      otherCurrencies: [...others.entries()].map(([currency, v]) => ({ currency, ...v })),
    },
  }
}

/** The last `count` months up to and including `now`, newest first. */
export function recentMonths(now: Date, count: number): Array<{ year: string; month: string }> {
  const months: Array<{ year: string; month: string }> = []
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  for (let i = 0; i < count; i++) {
    months.push({
      year: String(cursor.getUTCFullYear()),
      month: String(cursor.getUTCMonth() + 1).padStart(2, "0"),
    })
    cursor.setUTCMonth(cursor.getUTCMonth() - 1)
  }
  return months
}

const regex = (source?: string) => (source ? new RegExp(source, "i") : null)

const inText = (bill: Bill, pattern: RegExp | null) =>
  !!pattern && (pattern.test(bill.title) || bill.lines.some((line) => pattern.test(line)))

function matchesRule(bill: Bill, rule: RecurringRule): boolean {
  if (!rule.vendor && !rule.line) return false
  const byVendor = !!bill.vendorName && !!regex(rule.vendor)?.test(bill.vendorName)
  const byLine = inText(bill, regex(rule.line))
  if (!byVendor && !byLine) return false
  const title = regex(rule.title)
  return !title || inText(bill, title)
}

function isExcluded(bill: Bill, exclude: ContributeSettings["exclude"]): boolean {
  if (regex(exclude.vendor)?.test(bill.vendorName)) return true
  if (bill.category && exclude.categories?.includes(bill.category)) return true
  return inText(bill, regex(exclude.title))
}

/** A label short enough for a card; a bill with no usable line gets the vendor. */
function oneTimeLabel(bill: Bill): string {
  const candidate = (bill.lines[0] || bill.title || "").trim()
  if (candidate.length < 3) return `${bill.vendor} bill ${bill.reference}`
  return candidate.length > 80 ? `${candidate.slice(0, 79).trimEnd()}…` : candidate
}

/** The amount that comes up most often; ties go to the most recent. */
function typicalAmount(bills: Bill[]): number {
  const counts = new Map<number, number>()
  for (const bill of bills) counts.set(bill.totalAmount, (counts.get(bill.totalAmount) ?? 0) + 1)
  let best = bills[0].totalAmount
  let bestCount = 0
  for (const bill of bills) {
    const count = counts.get(bill.totalAmount) ?? 0
    if (count > bestCount) {
      best = bill.totalAmount
      bestCount = count
    }
  }
  return best
}

/**
 * Classify a year of bills. Pure, so the rules can be tested on fixtures.
 * `bills` must be newest first.
 */
export function classifyBills(bills: Bill[], config: ContributeSettings = CONFIG): ContributeExpenses {
  const positive = bills.filter((b) => !b.refund && b.totalAmount > 0)
  const claimed = new Set<number | string>()

  const recurring: ContributableExpense[] = []
  for (const rule of config.recurring) {
    const matching = rule.billed === false ? [] : positive.filter((b) => matchesRule(b, rule))
    for (const bill of matching) claimed.add(bill.id)
    // Drafts count here: a furniture bill waiting for validation is still
    // this month's furniture. For the amount, posted bills come first.
    const posted = matching.filter((b) => b.state === "posted")
    const source = posted.length > 0 ? posted : matching
    if (source.length === 0 && !rule.monthlyAmount && !rule.annualAmount) continue

    const amountEur =
      rule.monthlyAmount ?? (rule.annualAmount ? Math.round((rule.annualAmount / 12) * 100) / 100 : typicalAmount(source.slice(0, 6)))
    const latest = matching[0]
    recurring.push({
      slug: rule.slug,
      kind: "recurring",
      label: rule.label,
      vendor: rule.vendorLabel ?? (latest?.vendor || rule.label),
      amountEur,
      date: latest?.date ?? "",
      reference: rule.slug,
      description: rule.description,
      lines: latest?.lines ?? [],
      billCount: source.length,
      message: contributionMessage(rule.short ?? rule.label.toLowerCase()),
      ...(rule.annualAmount ? { annualAmount: rule.annualAmount } : {}),
      ...(rule.short ? { short: rule.short } : {}),
      uri: expenseUri(rule.slug),
    })
  }
  // Largest first: the page shows how the fixed costs compare.
  recurring.sort((a, b) => b.amountEur - a.amountEur)

  const minAmount = config.oneTimeMinAmount ?? 0
  const oneTime: ContributableExpense[] = positive
    .filter(
      (b) =>
        b.state === "posted" &&
        b.totalAmount >= minAmount &&
        !claimed.has(b.id) &&
        !isExcluded(b, config.exclude),
    )
    .map((bill) => {
      const label = oneTimeLabel(bill)
      return {
        slug: billSlug(bill.reference),
        uri: billUri(String(bill.id)),
        kind: "one-time" as const,
        label,
        vendor: bill.vendor,
        amountEur: bill.totalAmount,
        date: bill.date,
        reference: bill.reference,
        lines: bill.lines,
        billCount: 1,
        message: contributionMessage(bill.reference),
      }
    })

  return { recurring, oneTime, empty: bills.length === 0, pending: null }
}

/** Read the last year of bills and classify them. */
export function loadContributeExpenses(
  options: { dataDir?: string; now?: Date; config?: ContributeSettings } = {},
): ContributeExpenses {
  const dataDir = options.dataDir ?? DATA_DIR
  const config = options.config ?? CONFIG
  const bills: Bill[] = []
  for (const { year, month } of recentMonths(options.now ?? new Date(), config.oneTimeMonths || 12)) {
    const month_ = readMonthBills(dataDir, year, month)
    if (month_) bills.push(...month_)
  }
  bills.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const classified = classifyBills(bills, config)
  // Since chb 3.14 the list of what is still to pay is published as such;
  // it replaces the guess from the last year of bills.
  const pending = readPendingBills(dataDir, options.now)
  return pending ? { ...classified, oneTime: pending.expenses, pending: pending.summary } : classified
}

export function findExpense(slug: string, expenses: ContributeExpenses): ContributableExpense | null {
  return [...expenses.recurring, ...expenses.oneTime].find((e) => e.slug === slug) ?? null
}

/** The page address of an expense. */
export const expensePath = (expense: Pick<ContributableExpense, "slug">) => `/expenses/${expense.slug}`

/**
 * The expense an older or alternative address points at: chb's public
 * bill id (`b-…`), a bill number written as-is, or a merged cost's old slug.
 */
export function resolveExpenseSlug(slug: string, expenses: ContributeExpenses, config: ContributeSettings = CONFIG): string | null {
  const all = [...expenses.recurring, ...expenses.oneTime]
  const byId = all.find((e) => e.publicId === slug || e.slug === billSlug(slug))
  return byId?.slug ?? slugAlias(slug, config)
}

/** The current slug for an older one (a cost that was merged or renamed), if any. */
export function slugAlias(slug: string, config: ContributeSettings = CONFIG): string | null {
  return config.recurring.find((rule) => rule.aliases?.includes(slug))?.slug ?? null
}
