/**
 * Who has donated to the Commons Hub itself: every transaction tagged
 * category "donation" for the collective "commonshub", on any of its
 * accounts (card, bank, on-chain). Other collectives the Hub hosts (the
 * openletter campaign, …) tag their own donations and are not counted.
 *
 * Donors' names exist only in the members tier: chb leaves them out of the
 * public one on purpose ("no donor display names", docs/audiences.md), and
 * none of these donations came with a name chosen for a public list. So the
 * names are read, and shown, for members only; everyone else gets the count.
 */

import type { Tier } from "./data-paths"
import { listMonths, listYears } from "./dataset"
import { readMonthlyTransactions } from "./transactions"

export interface Donor {
  name: string
  total: number
  donations: number
  /** ISO date of the most recent donation. */
  lastAt: string
}

export interface DonorsSummary {
  donations: number
  /** Most recent first; empty unless read from the members tier. */
  latest: Donor[]
  /** Largest total first; empty unless read from the members tier. */
  largest: Donor[]
}

/**
 * Not a donor's name: wallet addresses (the null address is a card or
 * coffee-machine mint), the payment processor, and Stripe product labels
 * that stand in when the payer gave no name.
 */
const NOT_A_NAME = /^0x[0-9a-f]{6,}$|^stripe$|^\(?none\)?$|^anonymous$|^donation$|financial contribution|contribution to |\(donation\b|^support the commons hub/i

/** "DAMMAN XAVIER" → "Damman Xavier"; names already in mixed case stay as they are. */
export function tidyName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim().replace(/^(?:mr|mrs|ms|miss|dr|m|mme)\.?\s+(?=\S)/i, "")
  if (name !== name.toUpperCase()) return name
  return name.toLowerCase().replace(/(^|[\s'’\-/])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase())
}

export function isDonorName(raw: string | null | undefined): raw is string {
  if (!raw) return false
  const name = raw.replace(/\s+/g, " ").trim()
  return name.length >= 2 && !NOT_A_NAME.test(name)
}

/**
 * The same person, however their bank wrote the name: case, accents,
 * punctuation and word order do not matter ("HANQUIN MATHIEU" is
 * "Mathieu Hanquin"), and neither do titles ("Mr", "Mrs").
 */
export function donorKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w && !["mr", "mrs", "ms", "miss", "dr", "m", "mme"].includes(w))
    .sort()
    .join(" ")
}

/** One entry per donor (see donorKey), with their total and last gift. */
export function rankDonors(gifts: Array<{ name: string | null | undefined; amount: number; date: string }>): { latest: Donor[]; largest: Donor[] } {
  const byKey = new Map<string, Donor>()
  for (const gift of gifts) {
    if (!isDonorName(gift.name) || gift.amount <= 0) continue
    const name = tidyName(gift.name)
    const key = donorKey(name)
    const donor = byKey.get(key) ?? { name, total: 0, donations: 0, lastAt: gift.date }
    donor.total = Math.round((donor.total + gift.amount) * 100) / 100
    donor.donations++
    if (gift.date > donor.lastAt) donor.lastAt = gift.date
    byKey.set(key, donor)
  }
  const all = [...byKey.values()]
  return {
    latest: [...all].sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.total - a.total),
    largest: [...all].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
  }
}

const dayOf = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10)

export function loadDonors(tier: Tier, collective = "commonshub"): DonorsSummary {
  let donations = 0
  const gifts: Array<{ name: string | null | undefined; amount: number; date: string }> = []
  for (const year of listYears()) {
    for (const month of listMonths(year, tier)) {
      for (const tx of readMonthlyTransactions(year, month, tier)) {
        const meta = tx.metadata ?? {}
        if (meta.category !== "donation" || meta.collective !== collective || tx.amount <= 0) continue
        donations++
        if (tier === "members") gifts.push({ name: tx.counterparty, amount: tx.amount, date: dayOf(tx.timestamp) })
      }
    }
  }
  return { donations, ...(tier === "members" ? rankDonors(gifts) : { latest: [], largest: [] }) }
}
