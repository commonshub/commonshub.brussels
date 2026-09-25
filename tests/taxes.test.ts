import { describe, expect, test } from "@jest/globals"
import settings from "@/settings/settings.json"
import { type TaxRule, classifyTaxPayment, summarizeTaxes, vatQuarterOf } from "@/lib/taxes"

const RULES = (settings as unknown as { taxes: { rules: TaxRule[] } }).taxes.rules
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
    ])
    expect(payments[3].taxYear).toBe(2025)
  })

  test("Stripe's tax-service fee and ordinary payments are not taxes", () => {
    expect(classifyTaxPayment(tx("s", "2024-08-05T10:00:00Z", -0.05, "Automatic Taxes (2024-08-05): Automatic tax", "stripe_fee"), RULES)).toBeNull()
    expect(classifyTaxPayment(tx("r", "2026-08-01T10:00:00Z", -6546.76, "Rent August 2026"), RULES)).toBeNull()
    expect(classifyTaxPayment(tx("k", "2025-12-31T10:00:00Z", -45, "CHARGE KBC BRUSSELS BUSINESS PRO PART SUBJECT TO VAT : 26,52"), RULES)).toBeNull()
  })

  test("each VAT settlement is attributed to its quarter", () => {
    expect(vatQuarterOf("+++080/4505/13233+++ VAT 2026/Q1", "2026-04-15")).toBe("2026-Q1")
    expect(vatQuarterOf("0804.505.132 REMBOURSEMENT TVA 4E TRIM 2024", "2025-03-12")).toBe("2024-Q4")
    // No quarter named: the one before the payment.
    expect(vatQuarterOf("+++080/4505/13233+++", "2026-07-15")).toBe("2026-Q2")
    expect(vatQuarterOf("+++080/4505/13233+++", "2026-01-20")).toBe("2025-Q4")
  })

  test("the totals add up, per level and overall", () => {
    const summary = summarizeTaxes(PRODUCTION.map((t) => classifyTaxPayment(t, RULES)!))
    expect(Object.fromEntries(summary.levels.map((l) => [l.level, l.total]))).toEqual({
      local: 4981.24,
      regional: 20625.03,
      federal: 841.43,
    })
    expect(summary.total).toBe(26447.7)
    expect(summary.total).toBe(Math.round(summary.levels.reduce((s, l) => s + l.total, 0) * 100) / 100)
    expect(summary.since).toBe("2024-08-20")
    expect(summary.vatQuarters.map((q) => [q.quarter, q.amount])).toEqual([
      ["2026-Q2", 8152.21],
      ["2026-Q1", 4401.71],
      ["2024-Q4", -11712.49],
    ])
  })
})
