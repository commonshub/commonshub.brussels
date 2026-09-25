/**
 * @jest-environment node
 */
import { describe, expect, test, beforeAll, afterAll } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"
import { loadContributeExpenses, readMonthBills, readPendingBills, type ChbBill } from "@/lib/contribute-expenses"

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chb-bills-"))
const write = (rel: string, data: unknown) => {
  fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true })
  fs.writeFileSync(path.join(tmp, rel), JSON.stringify(data))
}

// chb 3.14's projection (docs/bills.md), public tier.
const bill = (over: Partial<ChbBill>): ChbBill => ({
  id: "b-1",
  number: "CHB-S/2026/09/0011",
  type: "bill",
  status: "pending",
  date: "2026-09-22",
  dueDate: "2026-09-29",
  vendor: { type: "business", name: "(De pistolei) FDAB", vat: "BE0829079982" },
  description: "Plateau de Luxe",
  lines: [{ description: "Plateau de Luxe", totalAmount: 129.74 }],
  category: "catering",
  currency: "EUR",
  totalAmount: 129.74,
  amountDue: 129.74,
  ...over,
})

beforeAll(() => {
  write("latest/public/pending-bills.json", {
    generatedAt: "2026-09-25T12:00:00Z",
    bills: [
      bill({}),
      bill({ id: "b-2", number: "CHB-S/2026/07/0003", date: "2026-07-09", dueDate: "2026-07-25", vendor: { type: "business", name: "Proximus SA de droit public" }, description: "[103062072388] Business Internet Mega Fiber", totalAmount: 54.45, amountDue: 54.45 }),
      bill({ id: "b-3", number: "CHB-S/2026/09/0020", vendor: { type: "individual" }, description: "Batteries", totalAmount: 30, amountDue: 12.5, status: "partially_paid" }),
      bill({ id: "b-usd", currency: "USD", totalAmount: 20, amountDue: 20 }),
      bill({ id: "b-cn", type: "credit_note", totalAmount: 50, amountDue: 50 }),
      bill({ id: "b-rev", status: "reversed", totalAmount: 70, amountDue: 70 }),
    ],
  })
  write("2026/08/public/bills.json", { bills: [bill({ id: "b-9", status: "paid", amountDue: 0, date: "2026-08-05", vendor: { type: "business", name: "Relieve Group" }, description: "Relieve furniture rental August 2026" })] })
})
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe("bills still to pay", () => {
  const now = new Date("2026-09-25T12:00:00Z")

  test("EUR bills with something left to pay, overdue first, credit notes and reversed bills left out", () => {
    const { expenses, summary } = readPendingBills(tmp, now)!
    expect(expenses.map((e) => [e.slug, e.amountEur, e.overdue])).toEqual([
      ["b-2", 54.45, true],
      ["b-1", 129.74, false],
      ["b-3", 12.5, false],
    ])
    expect(summary).toMatchObject({ count: 3, amountDue: 196.69, otherCurrencies: [{ currency: "USD", count: 1, amountDue: 20 }] })
  })

  test("each bill is covered by quoting its number, and individuals stay anonymous", () => {
    const { expenses } = readPendingBills(tmp, now)!
    const proximus = expenses[0]
    expect(proximus).toMatchObject({ vendor: "Proximus SA de droit public", label: "Business Internet Mega Fiber", reference: "CHB-S/2026/07/0003", message: "Contribution CHB-S/2026/07/0003", dueDate: "2026-07-25" })
    expect(expenses[2].vendor).toBe("Individual supplier")
  })

  test("the page's one-off list is the pending list once chb publishes it", () => {
    const loaded = loadContributeExpenses({ dataDir: tmp, now })
    expect(loaded.oneTime.map((e) => e.slug)).toEqual(["b-2", "b-1", "b-3"])
    expect(loaded.pending?.amountDue).toBe(196.69)
  })

  test("month files in chb 3.14's schema are read for the recurring costs", () => {
    const [aug] = readMonthBills(tmp, "2026", "08")!
    expect(aug).toMatchObject({ id: "b-9", state: "posted", vendor: "Relieve Group", title: "Relieve furniture rental August 2026", reference: "CHB-S/2026/09/0011" })
  })

  test("no pending list yet: nothing to show, no error", () => {
    expect(readPendingBills(path.join(tmp, "nowhere"), now)).toBeNull()
  })
})
