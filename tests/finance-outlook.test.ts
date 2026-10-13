/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals"
import { accountWindows, computeOutlook, isHubFlow, monthFlow, outlookMonths } from "@/lib/finance-outlook"
import type { Transaction } from "@/types/transactions"

const tx = (over: Partial<Transaction>): Transaction =>
  ({ accountSlug: "checking", currency: "EURe", type: "CREDIT", normalizedAmount: 0, amount: 0, metadata: {}, ...over }) as Transaction

const fixed = [
  { slug: "rent", label: "Rent", monthly: 6000 },
  { slug: "internet", label: "Internet", monthly: 50 },
  { slug: "property-tax", label: "Property tax", monthly: 1000, annual: 12000 },
]

describe("isHubFlow", () => {
  test("leaves out transfers between our accounts, hosted projects and other currencies", () => {
    expect(isHubFlow(tx({ type: "INTERNAL" }))).toBe(false)
    expect(isHubFlow(tx({ metadata: { category: "internal_transfer" } }))).toBe(false)
    expect(isHubFlow(tx({ metadata: { collective: "openletter" } }))).toBe(false)
    expect(isHubFlow(tx({ currency: "CHT" }))).toBe(false)
    expect(isHubFlow(tx({ metadata: { collective: "commonshub" } }))).toBe(true)
    expect(isHubFlow(tx({ currency: "EUR" }))).toBe(true)
  })
})

describe("monthFlow", () => {
  test("splits income and spending on our accounts only", () => {
    const accounts = accountWindows([{ slug: "checking" }, { slug: "stripe", accountId: "acct_1" }])
    const flow = monthFlow(
      "2026-09",
      [
        tx({ normalizedAmount: 100 }),
        tx({ accountSlug: "acct_1", currency: "EUR", normalizedAmount: 49.5 }),
        tx({ normalizedAmount: -6546.76, type: "BURN" }),
        tx({ normalizedAmount: -10000, type: "INTERNAL" }),
        tx({ accountSlug: "cht", normalizedAmount: 500 }),
      ],
      accounts,
    )
    expect(flow).toEqual({ month: "2026-09", income: 149.5, spending: 6546.76 })
  })

  test("an archived account counts until its archive day; exceptional losses are kept apart", () => {
    const accounts = accountWindows([{ slug: "old", archivedAt: "2026-05-26" }])
    const may25 = Date.parse("2026-05-25T13:00:00Z") / 1000
    const may27 = Date.parse("2026-05-27T09:00:00Z") / 1000
    const flow = monthFlow(
      "2026-05",
      [
        tx({ accountSlug: "old", timestamp: may25, normalizedAmount: 4000 }),
        tx({ accountSlug: "old", timestamp: may25, normalizedAmount: -110463.54, metadata: { category: "exceptional" } }),
        tx({ accountSlug: "old", timestamp: may27, normalizedAmount: 999 }),
      ],
      accounts,
    )
    expect(flow).toEqual({ month: "2026-05", income: 4000, spending: 0, exceptional: 110463.54 })
  })
})

describe("outlookMonths", () => {
  test("the past months oldest first, then the current one", () => {
    expect(outlookMonths(new Date("2026-02-10T00:00:00Z"), 3)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"])
  })
})

describe("computeOutlook", () => {
  const months = [
    { month: "2026-07", income: 5000, spending: 9000 },
    { month: "2026-08", income: 7000, spending: 11000 },
    { month: "2026-09", income: 6000, spending: 10000 },
    { month: "2026-10", income: 100, spending: 50000 },
  ]

  test("averages the complete months only, and the runway counts the unpaid bills first", () => {
    const o = computeOutlook({ cash: 20000, unpaid: [{ amountDue: 3000, overdue: true }, { amountDue: 1000 }], fixedCosts: fixed, months, window: 3 })
    expect(o.avgIncome).toBe(6000)
    expect(o.avgSpending).toBe(10000)
    expect(o.netBurn).toBe(4000)
    expect(o.unpaidBills).toEqual({ amount: 4000, count: 2, overdue: 3000, overdueCount: 1 })
    // (20000 - 4000) / 4000
    expect(o.runwayMonths).toBe(4)
    expect(o.fixedMonthly).toBe(7050)
    // The yearly tax is not due next month.
    expect(o.nextMonthFixed).toBe(6050)
    expect(o.afterCommitments).toBe(20000 - 4000 - 6050)
    expect(o.fixedCostsCovered).toBe(2.3)
    expect(o.months.at(-1)).toMatchObject({ month: "2026-10", partial: true })
    expect(o.window).toBe(3)
  })

  test("no runway end when income covers spending", () => {
    const o = computeOutlook({
      cash: 5000,
      unpaid: null,
      fixedCosts: fixed,
      months: [
        { month: "2026-09", income: 9000, spending: 8000 },
        { month: "2026-10", income: 0, spending: 0 },
      ],
    })
    expect(o.netBurn).toBe(-1000)
    expect(o.runwayMonths).toBeNull()
    expect(o.unpaidBills).toBeNull()
  })

  test("more bills than cash: no negative runway", () => {
    const o = computeOutlook({ cash: 1000, unpaid: [{ amountDue: 3000 }], fixedCosts: fixed, months, window: 3 })
    expect(o.runwayMonths).toBe(0)
    expect(o.fixedCostsCovered).toBe(0)
  })
})
