/**
 * @jest-environment node
 *
 * The quarter report reads chb's expenses.json (one row per bill) and
 * customers.json (one row per customer and month) from the viewer's tier.
 */
import { afterAll, describe, expect, test } from "@jest/globals"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "quarter-"))
process.env.DATA_DIR = root
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadQuarterlyOdoo } = require("@/lib/odoo-quarter") as typeof import("@/lib/odoo-quarter")

const write = (rel: string, data: unknown) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), JSON.stringify(data))
}

for (const month of ["07", "08", "09"]) {
  write(`2026/${month}/public/expenses.json`, { expenses: [] })
  write(`2026/${month}/public/customers.json`, { customers: [] })
}
write("2026/09/public/expenses.json", {
  expenses: [
    { id: "b-1", number: "CHB-S/2026/09/0013", kind: "bill", status: "pending", date: "2026-09-30", category: "cold-drinks",
      vendor: { id: "p-1", type: "organisation", name: "DelivCo SRL (Big Bag Delivery)" }, untaxedAmount: 502.1, vatAmount: 48.03, totalAmount: 550.13 },
    { id: "b-2", number: "CHB-S/2026/09/0014", kind: "credit_note", status: "paid", date: "2026-09-20", vendor: { id: "p-1", type: "organisation", name: "DelivCo SRL (Big Bag Delivery)" },
      untaxedAmount: 10, vatAmount: 2.1, totalAmount: 12.1 },
    { id: "b-3", number: "CHB-S/2026/09/0015", kind: "bill", status: "reversed", date: "2026-09-21", vendor: { type: "individual" }, untaxedAmount: 99, vatAmount: 0, totalAmount: 99 },
    { id: "b-5", number: "CHB-S/2026/09/0016", kind: "bill", status: "pending", date: "2026-09-01", currency: "USD", vendor: { type: "individual" },
      untaxedAmount: 15, vatAmount: 0, totalAmount: 15, totalAmountEUR: 13.12 },
    { id: "x-4", number: "", kind: "expense", status: "submitted", date: "2026-09-22", vendor: { type: "individual" }, totalAmount: 15 },
  ],
})
write("2026/09/public/customers.json", {
  customers: [
    { customer: { id: "p-9", type: "organisation", name: "ITS mobility GmbH" }, incomeType: "sales_services", invoices: 1, untaxedAmount: 1355, totalAmount: 1586.9, amountDue: 0 },
    { customer: { type: "individual", member: true }, individuals: 6, incomeType: "membership", invoices: 6, untaxedAmount: 1822.31, totalAmount: 2205, amountDue: 100 },
  ],
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe("quarterly report", () => {
  const data = loadQuarterlyOdoo("2026", 3, { showPii: false })

  test("every month read, nothing missing", () => {
    expect(data.missingMonths).toEqual([])
  })

  test("bills one by one: credit notes subtract, expense claims count, reversed bills are left out", () => {
    const bills = data.rows.filter((r) => r.type === "bill")
    expect(bills.map((b) => b.reference)).toEqual(["CHB-S/2026/09/0013", "Expense claim", "CHB-S/2026/09/0014", "CHB-S/2026/09/0016"])
    expect(bills[3]).toMatchObject({ totalAmount: 13.12, untaxedAmount: 13.12 }) // USD, in euros
    expect(bills[2]).toMatchObject({ direction: "refund", totalAmount: -12.1, vatAmount: -2.1 })
    expect(bills[1]).toMatchObject({ partnerLabel: "Expense claim", totalAmount: 15 })
    expect(data.totals).toMatchObject({ billsTotal: 566.15, vatDeductible: 45.93, billCount: 4 })
    expect(data.topVendors[0]).toMatchObject({ label: "DelivCo SRL (Big Bag Delivery)", count: 2, total: 538.03 })
  })

  test("income per customer and month; individuals merged and unnamed", () => {
    const invoices = data.rows.filter((r) => r.type === "invoice")
    expect(invoices.map((r) => r.partnerLabel)).toEqual(["ITS mobility GmbH", "Individual clients (6)"])
    expect(invoices[1]).toMatchObject({ category: "Membership", status: "partially_paid", vatAmount: 382.69 })
    expect(data.totals).toMatchObject({ invoicedTotal: 3791.9, vatCollected: 614.59, vatNet: 568.66 })
  })

  test("a month chb has not generated yet is reported, not an error", () => {
    expect(loadQuarterlyOdoo("2026", 4, { showPii: false }).missingMonths).toEqual(["10", "11", "12"])
  })
})
