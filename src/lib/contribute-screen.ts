/**
 * Who keeps the Commons Hub going, for the big screen (/contribute/screen):
 * two ranked lists of names, money and time, ordered by how much each person
 * gave but never saying how much.
 *
 * The page is public and shown on a TV, so it only ever names someone the
 * site already names to anonymous visitors:
 * - money: the lenders on /debt, a public ledger (largest loans first, as
 *   /contribute lists them). Donors are not named: their names exist only in
 *   the members tier (see lib/donors.ts), so only their count is shown.
 * - time: the people who received the most community tokens, from the
 *   public tier's yearly contributors.json, where chb keeps Discord display
 *   names on purpose (they are on /community already).
 * Nothing here reads the members tier, and only names leave this module.
 */

import type { Tier } from "./data-paths"
import { listYears, readTierJson } from "./dataset"
import { isExcludedContributor, normalizeContributor, type ContributorsFile } from "./contributors"
import { loadDebtLedger, type DebtHolder } from "./debt"
import { loadDonors } from "./donors"

/** The only tier this page reads. */
const TIER: Tier = "public"

export interface ContributeScreenData {
  /** Lenders, largest loan first. Names only. */
  lenders: string[]
  /** People, most tokens received first. Names only. */
  contributors: string[]
  /** How many donations the hub received; the donors themselves are not named. */
  donations: number
  /** ISO timestamp of the most recent data behind the lists. */
  updatedAt: string | null
}

/** Everyone who ever lent to the hub, largest total lent first (settled or not). */
export function lendersByLoan(holders: Array<Pick<DebtHolder, "name" | "minted">>): string[] {
  return holders
    .filter((h) => h.minted > 0)
    .sort((a, b) => b.minted - a.minted || a.name.localeCompare(b.name))
    .map((h) => h.name)
}

/**
 * Tokens received, summed over the given files (oldest first), one entry per
 * Discord account; the name is the one in the most recent file. Bots and
 * organisation accounts (settings.contributors.exclude) are left out.
 */
export function contributorsByTokens(files: ContributorsFile[], excluded?: Set<string>): string[] {
  const byId = new Map<string, { name: string; tokens: number }>()
  for (const file of files) {
    for (const raw of file.contributors ?? []) {
      const contributor = normalizeContributor(raw)
      if (isExcludedContributor(contributor, excluded)) continue
      const entry = byId.get(contributor.id) ?? { name: contributor.displayName, tokens: 0 }
      entry.name = contributor.displayName
      entry.tokens += Number(raw.tokens?.in) || 0
      byId.set(contributor.id, entry)
    }
  }
  return [...byId.values()]
    .filter((c) => c.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name))
    .map((c) => c.name)
}

export async function loadContributeScreen(limit = 12): Promise<ContributeScreenData> {
  const files = listYears()
    .map((year) => readTierJson<ContributorsFile & { generatedAt?: string }>(TIER, "contributors.json", year))
    .filter((file): file is ContributorsFile & { generatedAt?: string } => !!file)

  const ledger = await loadDebtLedger().catch(() => null)

  const dates = [ledger?.fetchedAt, ...files.map((f) => f.generatedAt)].filter((d): d is string => !!d).sort()

  return {
    lenders: ledger ? lendersByLoan(ledger.holders).slice(0, limit) : [],
    contributors: contributorsByTokens(files).slice(0, limit),
    donations: loadDonors(TIER).donations,
    updatedAt: dates[dates.length - 1] ?? null,
  }
}
