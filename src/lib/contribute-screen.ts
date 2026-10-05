/**
 * What /contribute/screen shows, the two currencies that keep the Commons
 * Hub going:
 * - yang, money: the fixed costs, and the latest donations with their
 *   amount, date and time. A donation is named only as its donor chose at checkout
 *   (lib/donor-thanks.ts): card donations by their choice, read from Stripe;
 *   bank transfers never.
 * - yin, time: a few photos from the #contributions channel that people
 *   liked, and who was thanked for a contribution lately: the community
 *   latest tokens issued, to whom, for what and how many (chb's
 *   tokens-issued.json), or else the people mentioned in #contributions
 *   (contributions.json); Discord display names, public in chb's data.
 *
 * Only the public tier is read.
 */

import settings from "@/settings/settings.json"

import type { Tier } from "./data-paths"
import { readTierJson } from "./dataset"
import { isExcludedContributor, normalizeContributor, type ContributorsFile } from "./contributors"
import type { DebtHolder } from "./debt"
import { loadStripeThanks, type StripeThanks } from "./donor-thanks"
import { getProxiedImageUrl } from "./image-proxy"
import { photoSource } from "./photos"
import { readGeneratedImages, type PopularPhoto } from "./reports"

/** The only tier this page reads. */
const TIER: Tier = "public"

export interface RecentDonation {
  /** Milliseconds. */
  at: number
  /** What the donor gave, in euros (before fees). */
  amount: number
  via: "card" | "bank transfer"
  /** As the donor chose to be shown; null for no name. */
  name: string | null
}

export interface RecentContributor {
  /** Who: one person, or several thanked together (same tokens, same reason, within the hour). */
  names: string[]
  /** Milliseconds; the latest of the group. */
  at: number
  /** Tokens issued to each of them, when known (chb's tokens-issued.json). */
  tokens?: number
  /** What for, when known. */
  reason?: string
}
export interface ContributionPhoto {
  src: string
  author: string
  /** Milliseconds. */
  at: number
}

export interface ContributeScreenData {
  donations: RecentDonation[]
  contributors: RecentContributor[]
  /** Where the names come from: tokens issued, people mentioned in #contributions, or who posted there. */
  contributorsFrom: "tokens" | "mentions" | "posts"
  photos: ContributionPhoto[]
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

// ── yang: donations ──────────────────────────────────────────────────────

interface DatasetTx {
  provider?: string
  currency?: string
  type?: string
  amount?: number
  grossAmount?: number
  timestamp?: number
  metadata?: { category?: string; collective?: string; description?: string; excluded?: boolean } | null
}

/** A donation to the hub itself, by card (Stripe) or bank transfer (KBC, or the EURe account via Monerium). */
function isHubDonation(tx: DatasetTx): boolean {
  const m = tx.metadata ?? {}
  if (m.excluded || !(Number(tx.amount) > 0) || !tx.timestamp) return false
  if (tx.type === "INTERNAL" || tx.type === "DEBIT" || tx.type === "BURN") return false
  if (m.collective && m.collective !== "commonshub") return false
  if (!["EUR", "EURe"].includes(tx.currency ?? "")) return false
  return m.category === "donation" || /\bdonation\b/i.test(m.description ?? "")
}

/**
 * The latest donations, newest first. A card donation takes the name its
 * donor chose, from the checkout it came from (same amount, paid within the
 * hour after the checkout opened); without one, or for a transfer, no name.
 */
export function recentDonations(txs: DatasetTx[], thanks: StripeThanks[] | null, limit = 4): RecentDonation[] {
  const used = new Set<StripeThanks>()
  return txs
    .filter(isHubDonation)
    .sort((a, b) => b.timestamp! - a.timestamp!)
    .slice(0, limit)
    .map((tx) => {
      const card = tx.provider === "stripe"
      let name: string | null = null
      if (card && thanks) {
        const cents = Math.round(Number(tx.grossAmount ?? tx.amount) * 100)
        const match = thanks
          .filter((t) => !used.has(t) && t.amount === cents && t.created <= tx.timestamp! + 300 && tx.timestamp! - t.created < 3600)
          .sort((a, b) => Math.abs(tx.timestamp! - a.created) - Math.abs(tx.timestamp! - b.created))[0]
        if (match) {
          used.add(match)
          name = match.name
        }
      }
      return { at: tx.timestamp! * 1000, amount: Number(tx.grossAmount ?? tx.amount), via: card ? "card" : "bank transfer", name }
    })
}

// ── yin: contributions ───────────────────────────────────────────────────

/** chb's feed of #contributions messages (YYYY/MM/public/contributions.json): when, who posted, who was mentioned. */
export interface ContributionsFeed {
  messages?: Array<{
    timestamp: string
    author?: { id?: string; displayName?: string; username?: string }
    mentions?: Array<{ id?: string; displayName?: string; username?: string }>
  }>
}

/**
 * Who contributed lately, newest first, each once: the people mentioned in
 * #contributions (that is how the community thanks someone, and what mints
 * them tokens), with when. Until chb publishes that feed, the people who
 * posted photos in #contributions, with when.
 */
export function recentContributors(feeds: ContributionsFeed[], photos: PopularPhoto[], limit = 5): RecentContributor[] {
  const latest = new Map<string, { name: string; at: number }>()
  const add = (person: { id?: string; displayName?: string | null; username?: string } | undefined, at: number) => {
    const name = person?.displayName || person?.username
    if (!name || !Number.isFinite(at) || isExcludedContributor({ username: person!.username, displayName: name })) return
    const key = person!.id || name.toLowerCase()
    if ((latest.get(key)?.at ?? 0) < at) latest.set(key, { name, at })
  }
  const messages = feeds.flatMap((f) => f.messages ?? [])
  if (messages.length > 0) {
    for (const m of messages) for (const person of m.mentions ?? []) add(person, Date.parse(m.timestamp))
  } else {
    for (const p of photos) if (p.channelId === settings.discord.channels.contributions) add(p.author, Date.parse(p.timestamp))
  }
  return [...latest.values()]
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map(({ name, at }) => ({ names: [name], at }))
}

/** chb's feed of community tokens issued (YYYY/MM/public/tokens-issued.json): to whom, for what, how many. No wallets. */
export interface TokensIssuedFeed {
  issued?: Array<{ timestamp: string; amount: number; recipient?: { id?: string; displayName?: string } | null; reason?: string | null }>
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"]

/**
 * What a token was for, short enough for one line: the token bot's
 * annotation, without a "Thank you to @<recipient> for" opening, cut at the
 * first sentence, without the @ of mentions.
 */
export function tokenReason(reason: string | null | undefined, recipient: string): string | undefined {
  let text = (reason ?? "").replace(/\s+/g, " ").trim()
  if (!text) return undefined
  const name = recipient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  text = text.replace(new RegExp(`^(?:a big )?(?:thank(?:s| you)) (?:to )?@?${name},? (?:for )?`, "i"), "")
  text = text.split(/(?<=[.!?])\s/)[0].replace(/[.!]+$/, "").replace(/@/g, "").trim()
  // "02/10/2026" reads "2 Oct" on a screen.
  text = text.replace(/\b(\d{1,2})\/(\d{1,2})\/\d{4}\b/g, (_, d: string, m: string) => `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`)
  return text ? text[0].toUpperCase() + text.slice(1) : undefined
}

/** Awards for the same thing, the same number of tokens, within an hour of each other, read as one line. */
const GROUP_MS = 3_600_000

/**
 * The latest tokens issued, newest first, grouped: awards with the same
 * reason and amount within the hour become one line naming everyone. Lines
 * the token bot described come first, so the screen says what tokens are
 * for; undescribed ones only fill the list when there are not enough.
 */
export function recentTokenAwards(feeds: TokensIssuedFeed[], limit = 5): RecentContributor[] {
  const awards = feeds
    .flatMap((f) => f.issued ?? [])
    .filter((t) => t.recipient?.displayName && !isExcludedContributor({ displayName: t.recipient.displayName }) && Number(t.amount) > 0)
    .map((t) => {
      const name = t.recipient!.displayName!
      return { name, at: Date.parse(t.timestamp), tokens: Number(t.amount), reason: tokenReason(t.reason, name) }
    })
    .filter((t) => Number.isFinite(t.at))
    .sort((a, b) => b.at - a.at)
  const groups: RecentContributor[] = []
  for (const award of awards) {
    const key = award.reason?.toLowerCase()
    const group = groups.find((g) => g.tokens === award.tokens && g.reason?.toLowerCase() === key && g.at - award.at < GROUP_MS)
    if (group) {
      if (!group.names.includes(award.name)) group.names.push(award.name)
    } else {
      groups.push({ names: [award.name], at: award.at, tokens: award.tokens, ...(award.reason ? { reason: award.reason } : {}) })
    }
  }
  const described = groups.filter((g) => g.reason).slice(0, limit)
  const filler = groups.filter((g) => !g.reason).slice(0, limit - described.length)
  return [...described, ...filler].sort((a, b) => b.at - a.at)
}

/** A few photos from #contributions that at least `minReactions` people reacted to, picked at random. */
export function contributionPhotos(photos: PopularPhoto[], { count = 4, minReactions = 2, random = Math.random } = {}): ContributionPhoto[] {
  const pool = photos.filter((p) => p.channelId === settings.discord.channels.contributions && p.totalReactions >= minReactions)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count).map((p) => ({
    src: getProxiedImageUrl(p.proxyUrl ?? photoSource(p), "md", { relative: true }),
    author: p.author?.displayName || p.author?.username || "",
    at: Date.parse(p.timestamp),
  }))
}

/** The last `count` months, newest first, as [year, month]. */
export function lastMonths(now: Date, count: number): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push([String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0")])
  }
  return out
}

export async function loadContributeScreen(now = new Date()): Promise<ContributeScreenData> {
  const months = lastMonths(now, 3)
  const txs = months.flatMap(([y, m]) => {
    const file = readTierJson<{ transactions?: DatasetTx[] } | DatasetTx[]>(TIER, "transactions.json", y, m)
    return Array.isArray(file) ? file : (file?.transactions ?? [])
  })
  const feeds = months.map(([y, m]) => readTierJson<ContributionsFeed>(TIER, "contributions.json", y, m)).filter((f): f is ContributionsFeed => !!f)
  const tokenFeeds = months.map(([y, m]) => readTierJson<TokensIssuedFeed>(TIER, "tokens-issued.json", y, m)).filter((f): f is TokensIssuedFeed => !!f)
  const awards = recentTokenAwards(tokenFeeds)
  const photos = months.flatMap(([y, m]) => readGeneratedImages(y, m, TIER))
  const oldest = Math.min(...txs.filter(isHubDonation).map((t) => t.timestamp!), Math.floor(now.getTime() / 1000))
  const thanks = await loadStripeThanks(oldest - 3600)

  return {
    donations: recentDonations(txs, thanks),
    contributors: awards.length > 0 ? awards : recentContributors(feeds, photos),
    contributorsFrom: awards.length > 0 ? "tokens" : feeds.some((f) => (f.messages ?? []).length > 0) ? "mentions" : "posts",
    photos: contributionPhotos(photos),
  }
}

export interface ScreenCost {
  slug: string
  label: string
  /** A month of it, rounded up to the euro. */
  amount: number
}

/**
 * The fixed costs as /contribute breaks them down, for the TV: whole euros,
 * rounded up, no shares. The total shown is the sum of the rounded amounts,
 * so the numbers on screen add up.
 */
export function screenCosts(recurring: Array<{ slug: string; label: string; amountEur: number }>): ScreenCost[] {
  return recurring.filter((c) => c.amountEur > 0).map((c) => ({ slug: c.slug, label: c.label, amount: Math.ceil(c.amountEur - 1e-9) }))
}
