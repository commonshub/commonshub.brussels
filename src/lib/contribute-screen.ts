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

export async function loadContributeScreen(limit = 36): Promise<ContributeScreenData> {
  const files = listYears()
    .map((year) => readTierJson<ContributorsFile & { generatedAt?: string }>(TIER, "contributors.json", year))
    .filter((file): file is ContributorsFile & { generatedAt?: string } => !!file)

  const ledger = await loadDebtLedger().catch(() => null)

  const dates = [ledger?.fetchedAt, ...files.map((f) => f.generatedAt)].filter((d): d is string => !!d).sort()

  return {
    lenders: ledger ? lendersByLoan(ledger.holders) : [],
    contributors: contributorsByTokens(files).slice(0, limit),
    donations: loadDonors(TIER).donations,
    updatedAt: dates[dates.length - 1] ?? null,
  }
}

export interface CloudName {
  name: string
  /** Font size in screen units: varied by chance, never by amount. */
  size: number
  accent: boolean
}

/** A small seeded random generator (mulberry32), so a day's cloud is stable but changes from day to day. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Everyone who lent money or gave time, as one cloud: each name once, in a
 * shuffled order, with sizes that vary by chance. It is not a ranking: the
 * order the lists come in (largest first) is deliberately thrown away.
 */
export function cloudNames(data: Pick<ContributeScreenData, "lenders" | "contributors">, seed: string): CloudName[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const name of [...data.lenders, ...data.contributors]) {
    const key = name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    names.push(name.trim())
  }
  const random = seeded(seed)
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[names[i], names[j]] = [names[j], names[i]]
  }
  const sizes = [1.7, 2, 2.3, 2.7]
  return names.map((name) => ({ name, size: sizes[Math.floor(random() * sizes.length)], accent: random() < 0.22 }))
}
