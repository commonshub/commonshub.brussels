import { describe, expect, test } from "@jest/globals"
import settings from "@/settings/settings.json"
import { type PendingTax, type TaxRule, type VatPeriod, classifyTaxPayment, openPending, summarizeTaxes, vatQuarterOf, vatRow } from "@/lib/taxes"

const TAXES = (settings as unknown as { taxes: { rules: TaxRule[]; pending: PendingTax[] } }).taxes
const RULES = TAXES.rules
const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)
const tx = (id: string, iso: string, amount: number, description: string, category: string | null = null) => ({
  id,
  timestamp: at(iso),
  amount,
  metadata: { description, category },
})

// The tax movements in the public transactions on production, as of September 2026.
const PRODUCTION = [
  tx("a", "2024-08-20T10:00:00Z", -7450.05, "CHB Propery tax Expense 215757"),
  tx("b", "2024-08-20T10:05:00Z", -4981.24, "CHB Office space tax Expense 215758"),
  tx("c", "2025-03-12T10:00:00Z", 11712.49, "0804.505.132 REMBOURSEMENT TVA 4E TRIM 2024", "vat"),
  tx("d", "2025-09-10T10:00:00Z", -13174.98, "CHB precompte immobilier 2025 expense 264830"),
  tx("e", "2026-04-15T10:00:00Z", -4401.71, "+++080/4505/13233+++ VAT 2026/Q1"),
  tx("f", "2026-07-15T10:00:00Z", -8152.21, "+++080/4505/13233+++"),
  // KBC renders the same structured reference with asterisks.
  tx("g", "2025-04-10T10:00:00Z", -3288.22, "***080/4505/13233***"),
  tx("h", "2025-05-10T10:00:00Z", -1, "***080/4505/13233***"),
  tx("i", "2025-10-10T10:00:00Z", -2824.49, "***080/4505/13233***"),
]

describe("tax payments", () => {
  test("recognised by description, paid positive and refunds negative", () => {
    const payments = PRODUCTION.map((t) => classifyTaxPayment(t, RULES)!)
    expect(payments.map((p) => [p.level, p.amount])).toEqual([
      ["regional", 7450.05],
      ["local", 4981.24],
      ["federal", -11712.49],
      ["regional", 13174.98],
      ["federal", 4401.71],
      ["federal", 8152.21],
      ["federal", 3288.22],
      ["federal", 1],
      ["federal", 2824.49],
    ])
    expect(payments[3].taxYear).toBe(2025)
  })

  test("Stripe's tax-service fee and ordinary payments are not taxes", () => {
    expect(classifyTaxPayment(tx("s", "2024-08-05T10:00:00Z", -0.05, "Automatic Taxes (2024-08-05): Automatic tax", "stripe_fee"), RULES)).toBeNull()
    expect(classifyTaxPayment(tx("r", "2026-08-01T10:00:00Z", -6546.76, "Rent August 2026"), RULES)).toBeNull()
    expect(classifyTaxPayment(tx("k", "2025-12-31T10:00:00Z", -45, "CHARGE KBC BRUSSELS BUSINESS PRO PART SUBJECT TO VAT : 26,52"), RULES)).toBeNull()
  })

  test("a VAT payment names its quarter only when its description does", () => {
    expect(vatQuarterOf("+++080/4505/13233+++ VAT 2026/Q1")).toBe("2026-Q1")
    expect(vatQuarterOf("0804.505.132 REMBOURSEMENT TVA 4E TRIM 2024")).toBe("2024-Q4")
    // Not guessed from the date: quarters get settled late and in parts.
    expect(vatQuarterOf("***080/4505/13233***")).toBeNull()
  })

  test("the totals add up, per level and overall", () => {
    const summary = summarizeTaxes(PRODUCTION.map((t) => classifyTaxPayment(t, RULES)!))
    expect(Object.fromEntries(summary.levels.map((l) => [l.level, l.total]))).toEqual({
      local: 4981.24,
      regional: 20625.03,
      federal: 6955.14,
    })
    expect(summary.total).toBe(32561.41)
    expect(summary.total).toBe(Math.round(summary.levels.reduce((s, l) => s + l.total, 0) * 100) / 100)
    expect(summary.since).toBe("2024-08-20")
  })
})

describe("pending bills", () => {
  const payments = PRODUCTION.map((t) => classifyTaxPayment(t, RULES)!)

  test("the bills in settings are listed with their level, and summed apart from what is paid", () => {
    const open = openPending(TAXES.pending, payments, RULES)
    expect(open.map((b) => [b.level, b.label, b.taxYear, b.amount])).toEqual([
      ["local", "Office tax", 2025, 12603.85],
      ["local", "Office tax", 2026, 12918.95],
      ["regional", "Property tax", 2026, 15195.19],
    ])
    const summary = summarizeTaxes(payments, open)
    expect(summary.pendingTotal).toBe(40717.99)
    expect(summary.total).toBe(32561.41) // pending never counts as paid
    expect(summary.levels.find((l) => l.level === "local")!.pendingTotal).toBe(25522.8)
  })

  test("a bill drops off once a payment for the same tax and year shows up", () => {
    const paid = classifyTaxPayment(tx("j", "2026-10-01T10:00:00Z", -12603.85, "CHB Office space tax 2025 Expense 300001"), RULES)!
    expect(paid.taxYear).toBe(2025)
    const open = openPending(TAXES.pending, [...payments, paid], RULES)
    expect(open.map((b) => `${b.kind} ${b.taxYear}`)).toEqual(["office-tax 2026", "property-tax 2026"])
    // The 2025 property tax payment already on the books settles nothing pending.
    expect(openPending([{ kind: "property-tax", taxYear: 2025, amount: 1 }], payments, RULES)).toEqual([])
  })
})

describe("VAT returns", () => {
  // Shaped like a period of latest/vat.json, with the totals of Q2 2026.
  const q2: VatPeriod = {
    period: "2026-Q2",
    year: 2026,
    quarter: 2,
    from: "2026-04-01",
    to: "2026-06-30",
    amendments: 1,
    grids: { "00": 2030, "02": 7730.11, "03": 47843.76, "48": 2919.63, "81": 1000, "82": 16889.35 },
    totals: { outputVat: 15027.64, inputVat: 3248.91, due: 11778.73, credit: 0, net: 11778.73, consistent: true },
  }

  test("a row sums sales and purchases from the grids and keeps the return's own totals", () => {
    expect(vatRow(q2)).toEqual({
      period: "2026-Q2",
      label: "2026 Q2",
      sales: 54684.24,
      purchases: 17889.35,
      outputVat: 15027.64,
      inputVat: 3248.91,
      net: 11778.73,
      corrected: true,
    })
  })
})
