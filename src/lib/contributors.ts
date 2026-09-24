/**
 * The "active contributors" wall on /community is for people. The Discord
 * activity behind it also counts bots and organisation accounts — Open
 * Collective posts there through its own user — and those are listed in
 * settings.json rather than shown as if they were members.
 */

import settings from "@/settings/settings.json"

export interface Contributor {
  id: string
  username: string
  displayName: string
  avatar: string | null
  contributionCount: number
  joinedAt?: string
  walletAddress?: string | null
}

/**
 * A contributor as chb writes it now: identity nested under `profile`,
 * activity under `discord` and `tokens`. Older files had the flat fields
 * (`username`, `displayName`, …) at the top level instead.
 */
export interface RawContributor {
  id: string
  profile?: { username?: string | null; name?: string | null; avatar_url?: string | null }
  discord?: { messages?: number; mentions?: number }
  tokens?: { in?: number; out?: number }
  contributionDays?: number
  username?: string
  displayName?: string
  avatar?: string | null
  contributionCount?: number
  joinedAt?: string
  [key: string]: unknown
}

export interface ContributorsFile {
  contributors: RawContributor[]
  summary?: { totalContributors?: number; [key: string]: unknown }
  totalMembers?: number
  activeCommoners?: number
  timestamp?: string
  [key: string]: unknown
}

/**
 * Both shapes at once: chb's nested fields stay as they are (some
 * components read those), and the flat fields every other page reads are
 * filled in from them. Activity is counted as components already did:
 * Discord messages plus tokens received.
 */
export function normalizeContributor(raw: RawContributor): RawContributor & Contributor {
  const username = raw.username || raw.profile?.username || raw.id
  return {
    ...raw,
    username,
    displayName: raw.displayName || raw.profile?.name || username,
    avatar: raw.avatar ?? raw.profile?.avatar_url ?? null,
    contributionCount: raw.contributionCount ?? (raw.discord?.messages ?? 0) + Math.round(raw.tokens?.in ?? 0),
  }
}

const EXCLUDED = new Set(
  ((settings as { contributors?: { exclude?: string[] } }).contributors?.exclude ?? []).map((name) =>
    name.toLowerCase(),
  ),
)

export function isExcludedContributor(contributor: Partial<Pick<Contributor, "username" | "displayName">>, excluded = EXCLUDED): boolean {
  return [contributor.username, contributor.displayName].some((name) => !!name && excluded.has(name.toLowerCase()))
}

/**
 * The file as served to the site: every contributor in both shapes, bots
 * and organisations left out, and the totals the pages read at the top.
 */
export function publicContributors<T extends ContributorsFile>(file: T, excluded = EXCLUDED): T & { contributors: Array<RawContributor & Contributor>; totalMembers: number; activeCommoners: number } {
  const contributors = (file.contributors ?? []).map(normalizeContributor).filter((c) => !isExcludedContributor(c, excluded))
  return {
    ...file,
    contributors,
    totalMembers: file.totalMembers ?? file.summary?.totalContributors ?? contributors.length,
    activeCommoners: file.activeCommoners ?? contributors.length,
  }
}
