/** Reads the tax payments out of every month's public transactions. */

import settings from "@/settings/settings.json"
import { listMonths, listYears } from "./dataset"
import { readMonthlyTransactions } from "./transactions"
import { type TaxPayment, type TaxRule, classifyTaxPayment } from "./taxes"

export interface PassThrough {
  year: number
  cadastralIncome: { ours: number; building: number; officeTaxBase: number }
  propertyTax: { building: number; ours: number }
  officeTax: { building: number; ours: number }
}

const CONFIG = (settings as unknown as { taxes: { rules: TaxRule[]; passThrough: PassThrough } }).taxes
export const TAX_RULES = CONFIG.rules
export const PASS_THROUGH = CONFIG.passThrough

export function loadTaxPayments(rules: TaxRule[] = TAX_RULES): TaxPayment[] {
  const seen = new Set<string>()
  const payments: TaxPayment[] = []
  for (const year of listYears()) {
    for (const month of listMonths(year, "public")) {
      for (const tx of readMonthlyTransactions(year, month, "public")) {
        if (seen.has(tx.id)) continue
        const payment = classifyTaxPayment(tx, rules)
        if (payment) {
          seen.add(tx.id)
          payments.push(payment)
        }
      }
    }
  }
  return payments
}
