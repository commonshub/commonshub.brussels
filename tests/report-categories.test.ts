/**
 * @jest-environment node
 *
 * The year/month reports group money by chb's own categories first; a VAT
 * refund reduces taxes instead of counting as income, and the net is unchanged.
 */
import { afterAll, describe, expect, jest, test } from "@jest/globals"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "cats-"))
const tx = (id: string, type: "CREDIT" | "DEBIT", amount: number, category?: string) => ({
  id: `iban:be46734072238636:tx:${id}`, provider: "kbcbrussels", accountSlug: "kbc", currency: "EUR", type,
  amount, normalizedAmount: amount, grossAmount: Math.abs(amount), timestamp: 1748736000,
  metadata: { collective: "commonshub", ...(category ? { category } : {}) },
})
const file = path.join(root, "2025", "06", "public", "transactions.json")
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, JSON.stringify({ transactions: [
  tx("1", "CREDIT", 44442, "subsidy"),
  tx("2", "CREDIT", 17000, "sponsoring"),
  tx("3", "DEBIT", -2416.1, "HR"),
  tx("4", "CREDIT", 11712.49, "vat"),
  tx("5", "DEBIT", -3288.22, "vat"),
  tx("6", "DEBIT", -100, "stripe_fee"),
  tx("7", "CREDIT", 500),
  { ...tx("8", "CREDIT", 44442, "subsidy"), metadata: { collective: "brusselspay", category: "subsidy" } },
  tx("9", "DEBIT", -7260, "accrual"),
  tx("10", "CREDIT", 10051.46, "opening_balance"),
  tx("11", "DEBIT", -10000, "internal_transfer"),
  { ...tx("12", "CREDIT", 999999, "donation"), metadata: { collective: "commonshub", category: "donation", excluded: "duplicate" } },
]}))
const taxonomy = path.join(root, "latest", "public", "categories.json")
fs.mkdirSync(path.dirname(taxonomy), { recursive: true })
fs.writeFileSync(taxonomy, JSON.stringify({ categories: [{ slug: "accrual", label: "Previous-year invoices", direction: "both" }] }))

let reports: typeof import("@/lib/reports")
process.env.DATA_DIR = root
jest.isolateModules(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  reports = require("@/lib/reports")
})
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe("report categories", () => {
  const f = () => reports.calculateMonthlyFinancials("2025", "06")
  const row = (key: string) => f().byCategory.find((r) => r.key === key)

  test("chb categories are used, not keyword guesses", () => {
    expect(row("subsidy")).toMatchObject({ label: "Grants & subsidies", income: 88884 })
    expect(row("sponsoring")).toMatchObject({ label: "Sponsorship", income: 17000 })
    expect(row("salaries")).toMatchObject({ label: "Salaries", expenses: 2416.1 })
    expect(row("fee")).toMatchObject({ expenses: 100 })
    expect(row("other_income")).toMatchObject({ income: 500 })
  })

  test("a VAT refund reduces taxes; it is not income; the net is unchanged", () => {
    const tax = row("tax")!
    expect(tax.income).toBe(0)
    expect(tax.expenses).toBeCloseTo(3288.22 - 11712.49, 2)
    const fin = f()
    expect(fin.income).toBeCloseTo(88884 + 17000 + 500, 2)
    expect(fin.net).toBeCloseTo(88884 + 17000 + 11712.49 + 500 - 2416.1 - 3288.22 - 100 - 7260, 2)
    const sum = (k: "income" | "expenses") => fin.byCategory.reduce((s, r) => s + r[k], 0)
    expect(sum("income")).toBeCloseTo(fin.income, 2)
    expect(sum("expenses")).toBeCloseTo(fin.expenses, 2)
  })

  test("per collective: a hosted project's subsidy is not the Hub's income; collectives add up to the totals", () => {
    const fin = f()
    const hub = fin.collectives.find((c) => c.key === "commonshub")!
    const bp = fin.collectives.find((c) => c.key === "brusselspay")!
    expect(bp.income).toBe(44442)
    expect(bp.byCategory.map((r) => r.key)).toEqual(["subsidy"])
    expect(hub.byCategory.find((r) => r.key === "subsidy")?.income).toBe(44442)
    expect(fin.collectives[0].income).toBeGreaterThanOrEqual(fin.collectives[1].income)
    expect(fin.collectives.reduce((s, c) => s + c.income, 0)).toBeCloseTo(fin.income, 2)
    expect(fin.collectives.reduce((s, c) => s + c.expenses, 0)).toBeCloseTo(fin.expenses, 2)
  })

  test("chb-only slugs take chb's label; transfers and opening balances are not flows", () => {
    expect(row("accrual")).toMatchObject({ label: "Previous-year invoices", expenses: 7260 })
    expect(row("opening_balance")).toBeUndefined()
    expect(row("donation")).toBeUndefined() // the only donation is excluded
    expect(row("internal_transfer")).toBeUndefined()
    expect(reports.reportCategoryFor(tx("z", "CREDIT", 1, "opening_balance") as never)).toBeNull()
  })

  test("reportCategoryFor gives a transaction its report row", () => {
    expect(reports.reportCategoryFor(tx("x", "CREDIT", 10, "sponsoring") as never)).toEqual({ key: "sponsoring", label: "Sponsorship" })
    expect(reports.reportCategoryFor({ ...tx("y", "DEBIT", -10), type: "TRANSFER" } as never)).toBeNull()
  })
})
