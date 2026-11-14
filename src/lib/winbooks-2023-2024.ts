/**
 * WinBooks, our books for the first financial year (July 2023 – December
 * 2024), next to what /2023-2024 counts from the money that moved.
 *
 * The WinBooks side is fixed: the year is closed. Its figures come from the
 * WinBooks export CITIZENSPR (2026-03-03), postings of book year 1, and its
 * split by category from the 2023–2024 income reconciliation (v3). The page
 * side is computed from the same dataset and the same rules as /2023-2024
 * (vatPosition), so it moves when that page moves.
 *
 * Each difference is explained by reasons with an amount, traced posting by
 * posting against the transactions. What the reasons do not cover is shown
 * as "not explained yet", never hidden.
 */

import type { CategoryTotal, Direction, Position } from "./vat-position"

const round = (n: number) => Math.round(n * 100) / 100

/** Why the two differ, grouped for the summary. */
export type Theme = "crypto" | "timing" | "debt" | "vat" | "stripe" | "category" | "noncash"

export const THEMES: Record<Theme, { title: string; why: string }> = {
  crypto: {
    title: "WinBooks counts some crypto grant money twice",
    why: "Grant money that arrived in crypto is booked once when it arrived and again when it was converted to EURe or moved between our wallets, and the conversions are valued at the dollar price rather than the euros received. The page counts it once, when it became EURe.",
  },
  timing: {
    title: "Booked for 2024, paid in 2025",
    why: "WinBooks books costs and sales when they are invoiced or accrued at year end. The page counts money when it moves, so invoices paid after 31 December 2024 are not on it.",
  },
  debt: {
    title: "Token top-ups are income on the page, a debt in WinBooks",
    why: "Brussels Pay, EURb and Zinne top-ups are owed to the merchants until the tokens are spent. WinBooks books them as debt (489306, 489308); the page lists them with income, outside the scope of VAT.",
  },
  vat: {
    title: "VAT",
    why: "WinBooks books sales and costs without VAT, except ticket sales, which it books with the VAT still in them. The page counts what was paid and takes the VAT out by rate.",
  },
  stripe: {
    title: "Stripe",
    why: "Stripe keeps its fees before paying out, so the page never sees them as a payment, and some Stripe sales were never booked in WinBooks.",
  },
  category: {
    title: "Booked under another category, or in other pieces",
    why: "The same money under a different category on each side (these cancel out across lines), and expense claims or card spending booked and paid in pieces that do not pair one to one.",
  },
  noncash: {
    title: "Costs that are not payments",
    why: "Exchange-rate differences, depreciation and payroll accruals are costs in WinBooks without a payment in these years.",
  },
}

export interface Reason {
  theme: Theme
  title: string
  detail: string
  /** WinBooks minus the page: positive when WinBooks has more. A function when it follows the page's own figures. */
  amount: number | ((p: Position) => number)
}

export interface ComparisonLine {
  key: string
  label: string
  direction: Direction
  winbooks: { amount: number; accounts: string }
  /** The page's categories (vatPosition keys) that make up this line; "*" takes every category no other line of its direction takes. */
  categories: string[]
  /** Compare without the VAT the page estimates in it (WinBooks is booked without VAT). */
  withoutVat: boolean
  reasons: Reason[]
  /** What the rest is called when the reasons do not cover it. */
  rest?: string
}

/** A payment the page lists among a category's large items. */
const itemIn = (p: Position, dir: Direction, category: string, date: string, amount: number) =>
  (p.byCategory[dir].get(category)?.items ?? []).some((i) => i.date === date && Math.abs(i.amount - amount) < 0.01)

const amountOf = (p: Position, dir: Direction, categories: string[], withoutVat = false) =>
  round(categories.reduce((s, c) => {
    const t = p.byCategory[dir].get(c)
    return s + (t ? t.amount - (withoutVat ? t.vat : 0) : 0)
  }, 0))

/** WinBooks totals of book year 1 (1 July 2023 – 31 December 2024). */
export const WINBOOKS = {
  income: 416_008.73,
  /** Class 6, without VAT. */
  expenseNet: 268_717.73,
  /** VAT booked with those costs (411000). */
  expenseVat: 25_623.96,
  /** VAT on sales, as declared (grids 54 − 64), and VAT deducted (grid 59): the returns, which WinBooks matches exactly. */
  declaredSalesVat: 1_912.43,
  deductedVat: 26_084.83,
  /** Input VAT on purchase invoices dated 2023–2024, deducted only in the 2025 returns (book year 2). */
  deductedIn2025: 8_850.94,
}

export const LINES: ComparisonLine[] = [
  {
    key: "funding",
    label: "Donations, grants and subsidies",
    direction: "income",
    winbooks: { amount: 333_065.12, accounts: "743000 (without the Stripe membership accrual), 744000, and the LI.FI receipt booked on 749000" },
    categories: ["donation", "grant", "subsidy"],
    withoutVat: false,
    reasons: [
      {
        theme: "crypto",
        title: "The 30 May 2024 grant money is counted twice",
        detail:
          "The second Celo grant tranche was swapped into €37,700.67 of EURe on 30 May 2024. WinBooks books it as USDC received (POLYUS 1) and again as the EURe moved to the savings wallet the next day (POLYGO 1, €12,707.00 + €24,895.77). The page counts it once, when it became EURe.",
        amount: 37_602.77,
      },
      {
        theme: "crypto",
        title: "The 2023 Celo grant: on arrival, and again when converted",
        detail:
          "WinBooks books the $24,000 received in November and December 2023 as €24,000 of subsidy (CELOUS 1, at $1 = €1), then books most of the same money again in 2024 when it was converted to EURe (part of the 30 May swap, and the €6,007.24 Uniswap swap). The page counts it only when it became EURe: €6,755.09 in November–December 2023, and the 2024 conversions like WinBooks.",
        amount: 17_244.91,
      },
      {
        theme: "crypto",
        title: "Regens Unite crypto donations are booked twice",
        detail:
          "The €5,214.82 of Regens Unite donations received on 1 January 2024 is booked again on 31 May 2024, when it moved between our own wallets (POLYUS 1, valued at €5,528.38).",
        amount: 5_528.38,
      },
      {
        theme: "crypto",
        title: "The 30 May swap is valued 6.01% higher",
        detail: "WinBooks values the 12 USDC pieces of the swap at €39,967.54; the EURe received was €37,700.67.",
        amount: 2_266.87,
      },
      {
        theme: "crypto",
        title: "October 2024 USDC valued at its dollar price",
        detail: "WinBooks books 7,749.99 USDC at €7,588.82 (POLYUS 3). The swap brought €7,036.14 of EURe, which is what the page counts.",
        amount: 552.68,
      },
      {
        theme: "category",
        title: "Plural Everything: a donation in WinBooks, sponsoring on the page",
        detail:
          "Plural paid its Regen Village invoice RV202411 on 27 July 2024 (€2,512.44). WinBooks books the payment on 743000 as a donation and keeps the invoice open as sponsoring, so it counts Plural twice (see Sponsoring).",
        amount: 2_512.44,
      },
      {
        theme: "category",
        title: "City of Brussels subsidy: not categorised on the page yet",
        detail: "The €3,000 subsidy of 6 August 2024 is in WinBooks (744000) but has no category on the page yet.",
        amount: (p) => (itemIn(p, "income", "", "2024-08-06", 3000) ? 3000 : 0),
      },
      {
        theme: "category",
        title: "Solifin: a campaign loan in WinBooks, a gift on the page",
        detail: "WinBooks books the €2,500 of 13 June 2024 (“Don Be Impact”) on 489308 with the campaign loans. We decided on 13 November 2026 that it is a gift.",
        amount: -2_500,
      },
      {
        theme: "category",
        title: "Money held for All for Climate, counted as donations on the page",
        detail:
          "€1,599.63 of Regens Unite event takings reached our KBC account in September 2023 for All for Climate ASBL. WinBooks books it as money held for them (489301), not income.",
        amount: -1_599.63,
      },
      {
        theme: "category",
        title: "Small gifts and test payments",
        detail:
          "WinBooks has €788.54 of small receipts on 743000 that the page counts elsewhere (Wise test payments and Brussels Pay demos, an Open Collective payment in USD, small Stripe payments, two invoices to collectives, a credit note). The page has €972.00 of small Stripe and bank donations that WinBooks books elsewhere.",
        amount: -183.46,
      },
    ],
  },
  {
    key: "sponsoring",
    label: "Sponsoring",
    direction: "income",
    winbooks: { amount: 48_213.69, accounts: "749001, and the Stripe sponsor accrual on 749000" },
    categories: ["sponsoring"],
    withoutVat: false,
    reasons: [
      {
        theme: "timing",
        title: "Kyoto Technologies never paid",
        detail: "Invoice RV202415 (€2,500) is in WinBooks 2024 but was never paid; a later credit note in Odoo cancels it.",
        amount: 2_500,
      },
      {
        theme: "stripe",
        title: "Citizen Wallet sponsor contributions through Stripe",
        detail: "WinBooks accrues €909.09 (without VAT) of monthly €100 sponsor contributions. The page has €224.60 of Stripe sponsoring and counts the rest of those payments in other categories.",
        amount: 684.49,
      },
      {
        theme: "noncash",
        title: "Bank fees and exchange on foreign sponsors",
        detail: "Stellar (€2,500 invoiced, €2,480 received), Proof of Vibes (€2,304.60 invoiced, €2,288.74 received) and GLO (€500 invoiced, €490 received).",
        amount: 45.86,
      },
      {
        theme: "category",
        title: "Plural Everything paid €12.44 more than invoiced",
        detail: "WinBooks has the €2,500 invoice; the page has the €2,512.44 payment (see Donations).",
        amount: -12.44,
      },
    ],
  },
  {
    key: "tickets",
    label: "Event tickets",
    direction: "income",
    winbooks: { amount: 14_166.88, accounts: "743001" },
    categories: ["ticket"],
    withoutVat: true,
    reasons: [
      {
        theme: "vat",
        title: "WinBooks books ticket sales with the VAT in them",
        detail: "The Stripe ticket accruals carry no VAT code, so the VAT was never taken out. The page takes out 21%.",
        amount: (p) => p.byCategory.income.get("ticket")?.vat ?? 0,
      },
      {
        theme: "debt",
        title: "Zinne token purchases booked as tickets",
        detail: "€611 received through Monerium and KBC in 2023 and January 2024 for Zinne tokens. The page counts them as token top-ups.",
        amount: 611,
      },
    ],
  },
  {
    key: "rooms",
    label: "Room rentals and coworking",
    direction: "income",
    winbooks: { amount: 14_120.53, accounts: "749000 (room-hire and coworking invoices, year-end accruals, the Stripe coworking accrual)" },
    categories: ["rental", "room_rental", "coworking"],
    withoutVat: true,
    reasons: [
      {
        theme: "timing",
        title: "Invoiced in 2024, paid in 2025",
        detail: "Declic (€350, and a €150 accrual), Agenor (€200), Climate for All (€50) and one €12.40 invoice have no payment in 2024.",
        amount: 762.4,
      },
      {
        theme: "category",
        title: "All for Climate invoice",
        detail: "Invoice VEN 14 to All for Climate ASBL (€466.39) was settled against the money we held for them, not paid.",
        amount: 466.39,
      },
      {
        theme: "stripe",
        title: "Stripe coworking never booked",
        detail: "€1,117.50 of Stripe coworking receipts (€923.55 without VAT) sits on a customer account with no invoice or accrual against it.",
        amount: -923.55,
      },
      {
        theme: "timing",
        title: "Credit notes for 2025",
        detail: "Two €250 credit notes to Seven Camp are booked in 2024 for coworking invoiced in 2025.",
        amount: -500,
      },
    ],
  },
  {
    key: "other-sales",
    label: "Other sales",
    direction: "income",
    winbooks: { amount: 1_850, accounts: "749000 (Stripe invoice A60E2C44-0001)" },
    categories: ["other_income", "consulting", "equipment", "webservice", "drinks", "catering"],
    withoutVat: true,
    reasons: [],
    rest: "Drinks and small sales, which WinBooks has inside the room-hire invoices",
  },
  {
    key: "membership",
    label: "Membership",
    direction: "income",
    winbooks: { amount: 4_139, accounts: "743000 (Stripe membership accrual)" },
    categories: ["membership"],
    withoutVat: false,
    reasons: [
      {
        theme: "debt",
        title: "Token top-ups inside the Stripe membership total",
        detail: "Stripe names the product: €2,574.50 of what WinBooks books as membership are Brussels Pay, EURb and Zinne top-ups.",
        amount: 2_574.5,
      },
    ],
  },
  {
    key: "top-ups",
    label: "Token top-ups",
    direction: "income",
    winbooks: { amount: 0, accounts: "none: debt on 489306 and 489308" },
    categories: ["debt", "debt:eurb"],
    withoutVat: false,
    reasons: [
      {
        theme: "debt",
        title: "Not income in WinBooks",
        detail: "Top-ups are owed to the merchants until the tokens are spent.",
        amount: (p) => -amountOf(p, "income", ["debt", "debt:eurb"]),
      },
    ],
  },
  {
    key: "uncategorised",
    label: "Not categorised yet",
    direction: "income",
    winbooks: { amount: 0, accounts: "none" },
    categories: [""],
    withoutVat: false,
    reasons: [
      {
        theme: "category",
        title: "City of Brussels subsidy",
        detail: "In WinBooks with the subsidies (see Donations, grants and subsidies).",
        amount: (p) => (itemIn(p, "income", "", "2024-08-06", 3000) ? -3000 : 0),
      },
    ],
    rest: "Receipts the page has not categorised yet",
  },
  {
    key: "winbooks-only",
    label: "Recoveries, corrections and interest",
    direction: "income",
    winbooks: { amount: 453.51, accounts: "749100, 749101, 749900, 750000, 754000" },
    categories: [],
    withoutVat: false,
    reasons: [
      {
        theme: "noncash",
        title: "Not money received from outside",
        detail: "Payroll recoveries (€62.97), an expense correction (€339.21), interest and exchange gains (€51.33).",
        amount: 453.51,
      },
    ],
  },
  {
    key: "loans",
    label: "Campaign loans",
    direction: "income",
    winbooks: { amount: 0, accounts: "489308 (a debt, not income)" },
    categories: ["loan"],
    withoutVat: false,
    reasons: [
      {
        theme: "debt",
        title: "Interest-free loans are money received on the page, a debt in WinBooks",
        detail: "The 2024 campaign loans, repaid in kind through debt tokens (see /debt), are booked on 489308 in WinBooks. The page counts them as money received, outside the scope of VAT.",
        amount: (p) => -amountOf(p, "income", ["loan"]),
      },
    ],
  },
  {
    key: "other-income",
    label: "Other categories on the page",
    direction: "income",
    winbooks: { amount: 0, accounts: "none" },
    categories: ["*"],
    withoutVat: true,
    reasons: [],
  },
  {
    key: "expenses",
    label: "All expenses",
    direction: "expense",
    winbooks: { amount: round(268_717.73 + 25_623.96), accounts: "class 6, plus the VAT booked with it" },
    categories: ["*"],
    withoutVat: false,
    reasons: [
      {
        theme: "timing",
        title: "Booked for 2024, paid in 2025",
        detail:
          "Year-end accruals and December invoices with no payment by 31 December 2024: XL Collective invoices for September to December 2024 (€17,471.00), three December invoices from a freelancer (€10,000), two invoices of 29 December (€10,164.00 with VAT), two more of €1,333.33, and smaller subscriptions.",
        amount: 42_671.05,
      },
      {
        theme: "noncash",
        title: "Payroll booked before it was paid",
        detail: "WinBooks books gross salaries and employer contributions for October to December 2024 (€9,057.08). The page counts what was paid by 31 December (€6,736.52); withholding tax and contributions followed in 2025.",
        amount: 2_320.56,
      },
      {
        theme: "noncash",
        title: "Exchange differences and depreciation",
        detail: "Exchange-rate differences (€1,686.53) and depreciation (€203.62).",
        amount: 1_890.15,
      },
      {
        theme: "stripe",
        title: "Stripe fees",
        detail: "Stripe keeps its fees before paying out. WinBooks books them; the page only sees the payout.",
        amount: 1_118.77,
      },
      {
        theme: "timing",
        title: "Refunds we received",
        detail: "The page subtracts refunds we received from expenses (€3,377.20, including a €1,600 payment that came back, which WinBooks still books as a cost).",
        amount: 3_377.2,
      },
      {
        theme: "vat",
        title: "Accruals booked without their VAT",
        detail: "Several accruals are booked without VAT (for example XL Collective's €4,379 invoices for October to December 2023, paid as €5,298.59 each). The payments the page counts include it.",
        amount: -3_913.1,
      },
      {
        theme: "category",
        title: "Payments and bookings that do not pair one to one",
        detail: "Expense claims booked as one invoice but paid in several transfers (or the other way round), Wise card spending booked from receipts, and rent booked on the Gnosis wallet.",
        amount: -4_937.53,
      },
    ],
  },
]

export interface ReasonResult extends Omit<Reason, "amount"> {
  amount: number
}

export interface LineResult {
  line: ComparisonLine
  winbooks: number
  page: number
  /** WinBooks minus the page. */
  difference: number
  reasons: ReasonResult[]
  /** The part of the difference no reason covers. */
  unexplained: number
  /** The page's categories in this line, with their amounts. */
  pageCategories: CategoryTotal[]
}

export interface Comparison {
  lines: LineResult[]
  income: { winbooks: number; page: number; difference: number }
  expense: { winbooks: number; page: number; difference: number }
  themes: { theme: Theme; amount: number }[]
  unexplained: number
}

/** Puts WinBooks next to the page's figures, line by line. */
export function compareWithWinbooks(p: Position): Comparison {
  const taken: Record<Direction, Set<string>> = { income: new Set(), expense: new Set() }
  for (const l of LINES) for (const c of l.categories) if (c !== "*") taken[l.direction].add(c)

  const lines = LINES.map((line): LineResult => {
    const cats = line.categories.includes("*")
      ? [...p.byCategory[line.direction].keys()].filter((c) => !taken[line.direction].has(c))
      : line.categories
    const pageCategories = cats.map((c) => p.byCategory[line.direction].get(c)).filter((t): t is CategoryTotal => !!t)
    const page = amountOf(p, line.direction, cats, line.withoutVat)
    const difference = round(line.winbooks.amount - page)
    const reasons = line.reasons
      .map((r) => ({ ...r, amount: round(typeof r.amount === "function" ? r.amount(p) : r.amount) }))
      .filter((r) => r.amount !== 0)
    const unexplained = round(difference - reasons.reduce((s, r) => s + r.amount, 0))
    return { line, winbooks: line.winbooks.amount, page, difference, reasons, unexplained, pageCategories }
  })

  const side = (dir: Direction) => {
    const ls = lines.filter((l) => l.line.direction === dir)
    const winbooks = round(ls.reduce((s, l) => s + l.winbooks, 0))
    const page = round(ls.reduce((s, l) => s + l.page, 0))
    return { winbooks, page, difference: round(winbooks - page) }
  }

  const byTheme = new Map<Theme, number>()
  for (const l of lines) for (const r of l.reasons) byTheme.set(r.theme, round((byTheme.get(r.theme) ?? 0) + r.amount))
  const themes = [...byTheme.entries()].map(([theme, amount]) => ({ theme, amount })).filter((t) => Math.abs(t.amount) >= 0.01).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  return { lines, income: side("income"), expense: side("expense"), themes, unexplained: round(lines.reduce((s, l) => s + l.unexplained, 0)) }
}
