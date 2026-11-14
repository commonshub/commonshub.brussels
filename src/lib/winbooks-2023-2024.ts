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
        title: "Brussels Pay demos and test payments: donations in WinBooks, not categorised on the page",
        detail:
          "21 small Wise receipts of September to December 2024 (€498.50, mostly Brussels Pay demos) are booked on 743000. The page has not categorised them yet (see Not categorised yet); €3 of them are €1 payments, which it leaves out.",
        amount: 498.5,
      },
      {
        theme: "category",
        title: "Other small receipts WinBooks books as donations",
        detail:
          "An Open Collective payment in dollars (€277.05; the page counts only euros), two December 2023 invoices to the DAO Brussels and Regens Unite Berlin collectives paid on their behalf by All for Climate (€111.36; not on the page), a Zinne top-up (€47.03) and two small Stripe sponsor payments (€39.10) that the page counts elsewhere, and a €1 test. Less a €50 credit note to Agenor.",
        amount: 425.54,
      },
      {
        theme: "category",
        title: "Small payments the page counts as donations, booked elsewhere in WinBooks",
        detail:
          "Two €220 Stripe coworking payments (coworking in WinBooks), a €100 Stripe membership, the €100 Citizen Wallet contribution of 5 June 2024 (with the hosting fees in WinBooks, see Sponsoring), two Revolut payments of €9 and €3 for Zinne tokens (booked as tickets) and BitSafe's €5 test payment (with its sponsoring).",
        amount: -657,
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
        theme: "category",
        title: "Citizen Wallet server hosting: sponsoring in WinBooks, web services on the page",
        detail:
          "WinBooks accrues eleven Stripe payments of €100 to Citizen Wallet (February to December 2024) as sponsoring, €909.09 after taking out 21% VAT (part of the Stripe “SERVICE” accrual). The page counts ten of them as server hosting for The Blockchain Socialist cooperative, a service to a business in another EU country without Belgian VAT (see Other sales), and the eleventh, of 5 June 2024, as a donation.",
        amount: 909.09,
      },
      {
        theme: "noncash",
        title: "Bank fees and exchange on foreign sponsors",
        detail: "Stellar (€2,500 invoiced, €2,480 received), Proof of Vibes (€2,304.60 invoiced, €2,288.74 received) and GLO (€500 invoiced, €490 received).",
        amount: 45.86,
      },
      {
        theme: "category",
        title: "Test payments before the sponsorship",
        detail: "BitSafe paid €5 before its €5,995 (the page counts it as a donation) and Proof of Vibes €1 (the page leaves out payments of €1 or less).",
        amount: 6,
      },
      {
        theme: "category",
        title: "Small Stripe sponsor payments booked as donations",
        detail: "Two Stripe payments (€23 on 14 July and €16.10 on 29 August 2024) are sponsoring on the page and donations in WinBooks.",
        amount: -39.1,
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
        detail: "€399 received through Monerium in October 2023 to January 2024 for Zinne tokens. The page counts them as token top-ups.",
        amount: 399,
      },
      {
        theme: "category",
        title: "Regens Unite ticket paid by bank: not categorised on the page yet",
        detail: "€200 received on KBC on 12 October 2023 (“payment from Felix for RGN”). WinBooks books it as a ticket; the page has no category for it yet.",
        amount: 200,
      },
      {
        theme: "category",
        title: "Booked as tickets, counted elsewhere on the page",
        detail: "A €27.50 day pass sold through Stripe in September 2024 (coworking on the page), two Revolut payments of €9 and €3 in November 2023 (donations on the page), and €0.72 of payments of €1 or less, which the page leaves out.",
        amount: 40.22,
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
        detail: "Declic (€350), Agenor (€200), Climate for All (€50) and one €12.40 invoice have no payment in 2024.",
        amount: 612.4,
      },
      {
        theme: "category",
        title: "All for Climate invoice: not categorised on the page yet",
        detail: "All for Climate ASBL paid invoice VEN 14 (€466.39) through Wise on 2 August 2024. The page has not categorised the payment yet (see Not categorised yet).",
        amount: 466.39,
      },
      {
        theme: "vat",
        title: "Two room hires booked without VAT",
        detail: "WinBooks books ADDMA's €500 room hire (paid on 17 July 2024) and the €526.35 deposit of 19 December 2024 (Sociale Innovatiefabriek) without VAT. The page takes 21% out of both.",
        amount: 178.13,
      },
      {
        theme: "category",
        title: "Rise for Climate paid in other pieces",
        detail: "Three invoices, €428.50 without VAT. Rise for Climate paid €333.73 on 8 October and €181.50 on 22 November 2024; the page counts €15.50 of the first payment as drinks and €413.00 (without VAT) as room hire.",
        amount: 15.5,
      },
      {
        theme: "stripe",
        title: "Stripe coworking never booked",
        detail: "Stripe received €3,345.50 for coworking in 2024 (after €363 of refunds). WinBooks books €2,677 of it (invoices paid through Stripe and the year-end accrual); €668.50 (€552.49 without VAT) has no invoice or accrual against it.",
        amount: -552.49,
      },
      {
        theme: "category",
        title: "Coworking in WinBooks, donations on the page",
        detail: "Two €220 Stripe coworking payments (2 September and 19 November 2024) are donations on the page.",
        amount: 363.64,
      },
      {
        theme: "stripe",
        title: "Refunded coworking subscriptions",
        detail: "WinBooks takes the €363 refunded to three coworkers off the coworking it books. The page counts the refunds with the money paid out.",
        amount: -300,
      },
      {
        theme: "category",
        title: "A day pass booked as a ticket",
        detail: "The €27.50 day pass of 4 September 2024 is a ticket in WinBooks and coworking on the page.",
        amount: -22.73,
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
    reasons: [
      {
        theme: "category",
        title: "Citizen Wallet server hosting: web services on the page, sponsoring in WinBooks",
        detail: "Ten monthly €100 Stripe payments from The Blockchain Socialist cooperative, without Belgian VAT (reverse charge). WinBooks books them with the sponsoring (see Sponsoring).",
        amount: -1000,
      },
      {
        theme: "category",
        title: "Wise cashback: other sales on the page, financial income in WinBooks",
        detail: "€81.51 of Wise balance cashback (€67.36 once the page takes VAT out). WinBooks books it on 754000 (see Recoveries, corrections and interest).",
        amount: -67.36,
      },
      {
        theme: "category",
        title: "An Amazon refund and Rise for Climate's drinks",
        detail: "The page counts a €48.09 Amazon card refund of 8 July 2024 as equipment sold (WinBooks takes it off the supplier's invoice) and €15.50 of Rise for Climate's payment of 8 October 2024 as drinks (WinBooks has it against their room-hire invoice).",
        amount: -52.55,
      },
    ],
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
        detail: "Stripe names the product: €2,644.50 of what WinBooks books as membership are Brussels Pay, EURb and Zinne top-ups.",
        amount: 2_644.5,
      },
      {
        theme: "category",
        title: "A membership the page counts as a donation",
        detail: "A €100 Stripe subscription of 22 October 2024.",
        amount: 100,
      },
      {
        theme: "stripe",
        title: "Refunded memberships",
        detail: "WinBooks takes the €110 refunded to members off the membership it books. The page counts the refunds with the money paid out.",
        amount: -110,
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
        title: "Card refunds and money paid back",
        detail:
          "€1,021.27 received in 2024, mostly on Wise: card purchases refunded (Eustore €338, Juma €287.50, bol.com €70.50, three €50 Banxa test purchases), a deposit paid back by JLO Concept (€170.92) and two small refunds. WinBooks takes €869.27 of them off the costs (see Expenses) and books the Banxa refunds and a €2 refund on a suspense account.",
        amount: -1_021.27,
      },
      {
        theme: "category",
        title: "Money for All for Climate",
        detail: "€699.96 received from All for Climate on 17 June 2024. WinBooks books it as money held for them (489301), not income.",
        amount: -699.96,
      },
      {
        theme: "category",
        title: "Brussels Pay demos and test payments",
        detail: "€495.50 of small Wise receipts, booked as donations in WinBooks (see Donations, grants and subsidies).",
        amount: -495.5,
      },
      {
        theme: "category",
        title: "All for Climate invoice",
        detail: "Payment of invoice VEN 14 on 2 August 2024, room hire in WinBooks (see Room rentals and coworking).",
        amount: -466.39,
      },
      {
        theme: "category",
        title: "Regens Unite ticket",
        detail: "€200 received on KBC on 12 October 2023, a ticket in WinBooks (see Event tickets).",
        amount: -200,
      },
      {
        theme: "debt",
        title: "Blockchain for Europe: a Brussels Pay top-up",
        detail: "€174.50 received on 4 December 2024, booked in WinBooks as Brussels Pay token debt (489306).",
        amount: -174.5,
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
        detail: "Payroll recoveries (€62.97), an expense correction (€339.21), interest, Wise cashback and exchange gains (€51.33; the page counts the cashback as other sales).",
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
        detail:
          "Refunds the two count differently (€2,459.84), including a €1,600 payment that came back, which WinBooks still books as a cost. Card refunds of 2024 (€869.27, and a €48.09 Amazon refund) are taken off the costs in WinBooks, while the page counts them as receipts (see Not categorised yet and Other sales).",
        amount: 2_459.84,
      },
      {
        theme: "category",
        title: "A transfer from the Brussels Pay multisig",
        detail: "€1,000 sent from the Brussels Pay multisig on 18 September 2024. WinBooks books it as a transfer between our own accounts (580003); the page counts it as an expense.",
        amount: -1_000,
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
