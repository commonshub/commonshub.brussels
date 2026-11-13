/** Reads what the VAT pages need from the dataset (public tier only). */

import * as fs from "fs"
import * as path from "path"
import type { Transaction } from "@/types/transactions"
import { tierDir } from "./data-paths"
import { listMonths } from "./dataset"
import { readMonthlyTransactions } from "./transactions"
import { quarterLastMonth } from "./vat-position"

/** Every public transaction filed under these years. */
export function loadTransactions(years: number[]): Transaction[] {
  return years.flatMap((y) => listMonths(String(y), "public").flatMap((m) => readMonthlyTransactions(String(y), m, "public")))
}

/** Months of the dataset in a quarter: a quarter we have no data for is not one we report on. */
export function quarterHasData(year: number, quarter: number): boolean {
  const months = new Set(listMonths(String(year), "public"))
  return [0, 1, 2].some((i) => months.has(String(quarter * 3 - 2 + i).padStart(2, "0")))
}

/**
 * Where chb publishes a return as downloaded from Intervat, the filer's
 * email and phone removed: <year>/<last month>/public/intervat/<statement>.xml.
 */
export function vatXmlFile(year: number, quarter: number, statementId: string): string | null {
  if (!/^\d+$/.test(statementId)) return null
  return path.join(tierDir("public", String(year), quarterLastMonth(quarter)), "intervat", `${statementId}.xml`)
}

export function vatXmlExists(year: number, quarter: number, statementId: string): boolean {
  const file = vatXmlFile(year, quarter, statementId)
  return !!file && fs.existsSync(file)
}

/**
 * The first month with a transaction for each account: an account whose
 * history starts after a period has its income for that period missing.
 */
export function firstMonthByAccount(years: number[]): Map<string, string> {
  const first = new Map<string, string>()
  for (const y of years) {
    for (const m of listMonths(String(y), "public")) {
      for (const tx of readMonthlyTransactions(String(y), m, "public")) {
        const key = `${y}-${m}`
        if (!first.has(tx.accountSlug) || key < first.get(tx.accountSlug)!) first.set(tx.accountSlug, key)
      }
    }
  }
  return first
}
