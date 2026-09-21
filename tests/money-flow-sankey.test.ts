import { describe, expect, test } from "@jest/globals"
import { layoutMoneyFlow } from "@/components/money-flow-sankey"

// August 2026 as reported: income 9,927, expenses 2,507, opening 18,292, closing 25,712.
const august = {
  income: 9926.88,
  expenses: 2506.99,
  net: 7419.89,
  openingBalance: 18291.97,
  closingBalance: 25711.86,
  incomeBreakdown: [
    { key: "other-income", label: "Other income", income: 6905, expenses: 0, net: 6905 },
    { key: "coworking", label: "Coworking", income: 1633, expenses: 0, net: 1633 },
    { key: "donations", label: "Donations", income: 532, expenses: 0, net: 532 },
    { key: "memberships", label: "Memberships", income: 530, expenses: 0, net: 530 },
    { key: "rentals", label: "Rentals", income: 182, expenses: 0, net: 182 },
    { key: "food", label: "Food & drinks", income: 97, expenses: 0, net: 97 },
    { key: "fees", label: "Fees", income: 48, expenses: 2, net: 46 },
  ],
  expenseBreakdown: [
    { key: "catering", label: "Catering", income: 0, expenses: 1086, net: -1086 },
    { key: "other-expenses", label: "Other expenses", income: 0, expenses: 575, net: -575 },
    { key: "refunds", label: "Refunds", income: 0, expenses: 302, net: -302 },
    { key: "utilities", label: "Utilities", income: 0, expenses: 293, net: -293 },
    { key: "insurance", label: "Insurance", income: 0, expenses: 243, net: -243 },
    { key: "equipment", label: "Equipment", income: 0, expenses: 3, net: -3 },
    { key: "taxes", label: "Taxes", income: 0, expenses: 2, net: -2 },
    { key: "fees", label: "Fees", income: 48, expenses: 2, net: 46 },
  ],
}

describe("money flow layout", () => {
  const layout = layoutMoneyFlow(august)
  const sources = layout.nodes.filter((n) => n.kind === "source" || n.kind === "opening")
  const uses = layout.nodes.filter((n) => n.kind === "use" || n.kind === "closing")

  test("both sides add up to what went through the treasury", () => {
    const inflow = sources.reduce((s, n) => s + n.value, 0)
    const outflow = uses.reduce((s, n) => s + n.value, 0)
    expect(inflow).toBeCloseTo(outflow, 0)
    expect(inflow).toBeCloseTo(layout.treasury.value, 0)
    // No money had to come out of the opening balance: income covered everything.
    expect(sources.find((n) => n.kind === "opening")).toBeUndefined()
    expect(uses.find((n) => n.kind === "closing")?.value).toBeCloseTo(9926.88 - 2506.99, 0)
  })

  test("bands fill the treasury bar exactly, on both sides", () => {
    const inBands = layout.links.filter((l) => l.to.id === "treasury")
    const outBands = layout.links.filter((l) => l.from.id === "treasury")
    const sum = (bands: typeof inBands) => bands.reduce((s, b) => s + b.height, 0)
    expect(sum(inBands)).toBeCloseTo(layout.treasury.height, 0)
    expect(sum(outBands)).toBeCloseTo(layout.treasury.height, 0)
    for (const band of [...inBands, ...outBands]) {
      expect(band.fromY).toBeGreaterThanOrEqual(band.from.y - 0.01)
      expect(band.fromY + band.height).toBeLessThanOrEqual(band.from.y + band.from.height + 0.01)
    }
  })

  test("nodes never overlap and the picture is as tall as the tallest stack", () => {
    for (const column of [sources, uses]) {
      for (let i = 1; i < column.length; i++) {
        expect(column[i].y).toBeGreaterThanOrEqual(column[i - 1].y + column[i - 1].height)
      }
      const last = column[column.length - 1]
      expect(last.y + last.height).toBeLessThanOrEqual(layout.height)
    }
    expect(uses.length).toBeLessThanOrEqual(8) // top 6 + Other + closing balance
    // €3 equipment, €2 taxes and €2 fees are folded into "Other", not padded into labelled nodes.
    expect(uses.map((n) => n.label)).not.toContain("Equipment")
    expect(uses.find((n) => n.label === "Other")?.value).toBeCloseTo(8, 0)
  })

  test("a month living off the opening balance shows it as a source", () => {
    const lean = layoutMoneyFlow({ income: 1000, expenses: 4000, net: -3000, openingBalance: 10000, closingBalance: 7000 })
    const opening = lean.nodes.find((n) => n.kind === "opening")
    expect(opening?.value).toBeCloseTo(3000, 0)
    expect(lean.nodes.find((n) => n.kind === "closing")).toBeUndefined()
    expect(lean.opening).toBe(10000)
    expect(lean.closing).toBe(7000)
  })
})
