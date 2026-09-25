/**
 * Who has donated to the Commons Hub itself (collective "commonshub",
 * category "donation"), by name.
 *
 * Donors' names exist only in the members tier: chb leaves them out of the
 * public one on purpose ("no donor display names", docs/audiences.md), and
 * none of these donations came with a name the donor chose for a public
 * list. So the names are read, and shown, for members only; everyone else
 * gets the count. Wallet addresses and payment-form labels are not names.
 */

import type { Tier } from "./data-paths"
import { listMonths, listYears } from "./dataset"
import { readMonthlyTransactions } from "./transactions"

export interface DonorsSummary {
  donations: number
  /** Distinct donors by name; empty unless read from the members tier. */
  names: string[]
}

const NOT_A_NAME = /^0x[0-9a-f]{6,}|^financial contribution to|^anonymous$|^donation\b/i

/** "DAMMAN XAVIER" → "Damman Xavier"; names already in mixed case stay as they are. */
export function tidyName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim()
  if (name !== name.toUpperCase()) return name
  return name.toLowerCase().replace(/(^|[\s'’\-/])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase())
}

export function donorNames(counterparties: Array<string | null | undefined>): string[] {
  const byKey = new Map<string, string>()
  for (const raw of counterparties) {
    if (!raw || NOT_A_NAME.test(raw.trim())) continue
    const name = tidyName(raw)
    if (name.length < 2) continue
    const key = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    if (!byKey.has(key)) byKey.set(key, name)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
}

export function loadDonors(tier: Tier, collective = "commonshub"): DonorsSummary {
  let donations = 0
  const counterparties: Array<string | null | undefined> = []
  for (const year of listYears()) {
    for (const month of listMonths(year, tier)) {
      for (const tx of readMonthlyTransactions(year, month, tier)) {
        const meta = tx.metadata ?? {}
        if (meta.category !== "donation" || meta.collective !== collective || tx.amount <= 0) continue
        donations++
        if (tier === "members") counterparties.push(tx.counterparty)
      }
    }
  }
  return { donations, names: tier === "members" ? donorNames(counterparties) : [] }
}
