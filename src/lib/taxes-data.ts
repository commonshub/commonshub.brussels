/** Reads the tax payments out of every month's public transactions. */

import * as fs from "fs"
import * as path from "path"
import settings from "@/settings/settings.json"
import { DATA_DIR } from "./data-paths"
import { listMonths, listYears } from "./dataset"
import { readMonthlyTransactions } from "./transactions"
import { type PendingTax, type TaxPayment, type TaxRule, type VatFile, classifyTaxPayment } from "./taxes"

export interface PassThrough {
  year: number
  cadastralIncome: { ours: number; building: number; officeTaxBase: number }
  propertyTax: { building: number; ours: number }
  officeTax: { building: number; ours: number }
}

const CONFIG = (settings as unknown as { taxes: { rules: TaxRule[]; pending?: PendingTax[]; passThrough: PassThrough } }).taxes
export const TAX_RULES = CONFIG.rules
export const PENDING_TAXES = CONFIG.pending ?? []
export const PASS_THROUGH = CONFIG.passThrough

/**
 * Every VAT return chb has imported from Intervat. Public and the same for
 * every audience, so it sits once at latest/vat.json, outside the tiers.
 */
export function loadVatReturns(): VatFile | null {
  const file = path.join(DATA_DIR, "latest", "vat.json")
  try {
    return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as VatFile) : null
  } catch (error) {
    console.error("[taxes] could not read vat.json:", error)
    return null
  }
}

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
