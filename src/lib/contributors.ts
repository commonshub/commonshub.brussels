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

export interface ContributorsFile {
  contributors: Contributor[]
  totalMembers?: number
  activeCommoners?: number
  timestamp?: string
  [key: string]: unknown
}

const EXCLUDED = new Set(
  ((settings as { contributors?: { exclude?: string[] } }).contributors?.exclude ?? []).map((name) =>
    name.toLowerCase(),
  ),
)

export function isExcludedContributor(contributor: Pick<Contributor, "username" | "displayName">, excluded = EXCLUDED): boolean {
  return excluded.has(contributor.username.toLowerCase()) || excluded.has(contributor.displayName.toLowerCase())
}

/** The file as served to the site: bots and organisations left out. */
export function publicContributors<T extends ContributorsFile>(file: T, excluded = EXCLUDED): T {
  return { ...file, contributors: file.contributors.filter((c) => !isExcludedContributor(c, excluded)) }
}
