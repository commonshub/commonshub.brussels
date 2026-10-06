/**
 * What /contributions/screen shows: the thank-yous posted in 💝praise and
 * what people logged in #contributions, both public channels whose messages
 * chb publishes in the public tier (YYYY/MM/public/praise.json and
 * contributions.json: text with mentions as @Name, reactions, images).
 *
 * Two designs share this data: a constellation of who thanked whom
 * (/contributions/screen/1) and a wall of sticky notes and polaroids
 * (/contributions/screen/2).
 */

import type { Tier } from "./data-paths"
import { readTierJson } from "./dataset"
import { isExcludedContributor, normalizeContributor, type ContributorsFile } from "./contributors"
import { getProxiedImageUrl } from "./image-proxy"
import { lastMonths } from "./contribute-screen"
import { photoSource } from "./photos"

/** The only tier this page reads. */
const TIER: Tier = "public"

interface FeedPerson {
  id?: string
  displayName?: string | null
  username?: string | null
  avatarUrl?: string | null
}

/** chb's feed of a channel's messages (praise.json, contributions.json). */
export interface ChannelFeed {
  messages?: Array<{
    id?: string
    timestamp: string
    author?: FeedPerson
    content?: string | null
    mentions?: FeedPerson[]
    /** A custom server emoji comes as ":name:" with its imageUrl. */
    reactions?: Array<{ emoji: string; count: number; imageUrl?: string }>
    totalReactions?: number
    images?: string[]
  }>
}

export interface ScreenPerson {
  /** Discord id, or the name when there is none. */
  id: string
  name: string
  /** Proxied, small; absent when the person has no avatar. */
  avatar?: string
}

export interface Praise {
  id: string
  /** Milliseconds. */
  at: number
  from: ScreenPerson
  to: ScreenPerson[]
  /** What for, without the mentions it starts with: "for figuring out the door!". */
  text: string
}

export interface Contribution {
  id: string
  at: number
  author: ScreenPerson
  text: string
  /** Proxied photo, when the message had one. */
  image?: string
  /** For a contribution without a photo: an emoji that fits what was done. */
  emoji: string
  reactions: Array<{ emoji: string; count: number; image?: string }>
}

const nameOf = (p?: FeedPerson | null) => (p?.displayName || p?.username || "").trim()

function person(p: FeedPerson | undefined, avatars: Map<string, string>): ScreenPerson | null {
  const name = nameOf(p)
  if (!name || isExcludedContributor({ displayName: name, username: p?.username ?? undefined })) return null
  const id = p?.id || name.toLowerCase()
  const avatar = p?.avatarUrl || avatars.get(id)
  return { id, name, ...(avatar ? { avatar: getProxiedImageUrl(avatar, "xs", { relative: true }) } : {}) }
}

/** Cut at a word boundary, with an ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.!?-]+$/, "")}…`
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** One line of plain text: no Markdown, no links, no custom emoji codes, single spaces. */
export function plainText(content: string | null | undefined): string {
  return (content ?? "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(\*\*|__|~~|\|\||`)/g, "")
    .replace(/^\s*(?:[-*>]|#{1,3})\s+/gm, "")
    .replace(/:[a-z0-9_]+:/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * The words of a thank-you, without the mentions it opens with ("@Leen
 * @Dean for mopping" → "for mopping"); later mentions lose their "@".
 */
export function praiseText(content: string | null | undefined, recipients: string[], max = 170): string {
  let text = plainText(content)
  const names = recipients.filter(Boolean).map(escape).sort((a, b) => b.length - a.length)
  if (names.length) {
    const mention = `@(?:${names.join("|")})`
    const lead = new RegExp(`^${mention}(?:\\s*(?:,|and|&)?\\s*${mention})*[\\s,:]*`, "i")
    text = text.replace(lead, "")
  }
  text = text.replace(/@(\S)/g, "$1").trim()
  return clip(text, max)
}

const EMOJI: Array<[RegExp, string]> = [
  [/vacu|clean|mop|sweep|swept|floor|tidy|tidied|broom/i, "🧹"],
  [/dish|kitchen|wash/i, "🍽️"],
  [/coffee|tea\b|beans/i, "☕"],
  [/toilet|paper|soap|suppl/i, "🧻"],
  [/cook|food|soup|meal|snack|lunch|dinner|potluck|bread|cake/i, "🍲"],
  [/plant|garden|flower|park/i, "🌱"],
  [/fix|repair|built|build|install|door|light|screw|paint/i, "🔧"],
  [/shift|steward|host|welcom/i, "🕗"],
  [/workshop|present|talk|session|facilitat/i, "🎤"],
  [/poster|flyer|design|photo|video/i, "🎨"],
  [/trash|garbage|bin|recycl/i, "♻️"],
]

export function contributionEmoji(text: string): string {
  return EMOJI.find(([re]) => re.test(text))?.[1] ?? "✨"
}

function avatarsById(): Map<string, string> {
  const file = readTierJson<ContributorsFile>(TIER, "contributors.json")
  const out = new Map<string, string>()
  for (const raw of file?.contributors ?? []) {
    const c = normalizeContributor(raw)
    if (c.id && c.avatar) out.set(String(c.id), c.avatar)
  }
  return out
}

/** Thank-yous that name someone, newest first, within `days`. */
export function recentPraises(feeds: ChannelFeed[], { now = Date.now(), days = 14, limit = 24, avatars = new Map<string, string>() } = {}): Praise[] {
  const since = now - days * 86_400_000
  const seen = new Set<string>()
  const out: Praise[] = []
  const messages = feeds.flatMap((f) => f.messages ?? []).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  for (const m of messages) {
    const at = Date.parse(m.timestamp)
    if (!Number.isFinite(at) || at < since) continue
    const id = m.id || `${m.timestamp}-${nameOf(m.author)}`
    if (seen.has(id)) continue
    const from = person(m.author, avatars)
    if (!from) continue
    const to: ScreenPerson[] = []
    for (const p of m.mentions ?? []) {
      const r = person(p, avatars)
      if (r && r.id !== from.id && !to.some((t) => t.id === r.id)) to.push(r)
    }
    if (to.length === 0) continue
    const text = praiseText(m.content, (m.mentions ?? []).map(nameOf))
    if (!text) continue
    seen.add(id)
    out.push({ id, at, from, to, text })
    if (out.length >= limit) break
  }
  return out
}

/** What people logged in #contributions, newest first: with words or a photo. */
export function recentContributions(feeds: ChannelFeed[], { limit = 8, avatars = new Map<string, string>() } = {}): Contribution[] {
  const seen = new Set<string>()
  const out: Contribution[] = []
  const messages = feeds.flatMap((f) => f.messages ?? []).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  for (const m of messages) {
    const at = Date.parse(m.timestamp)
    const id = m.id || `${m.timestamp}-${nameOf(m.author)}`
    if (!Number.isFinite(at) || seen.has(id)) continue
    const author = person(m.author, avatars)
    if (!author) continue
    const text = clip(plainText(m.content).replace(/@(\S)/g, "$1"), 110)
    const photo = (m.images ?? [])[0]
    if (!text && !photo) continue
    seen.add(id)
    out.push({
      id,
      at,
      author,
      text,
      ...(photo ? { image: getProxiedImageUrl(photoSource({ url: "", filePath: photo }), "md", { relative: true }) } : {}),
      emoji: contributionEmoji(text),
      reactions: [...(m.reactions ?? [])]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((r) => ({ emoji: r.emoji, count: r.count, ...(r.imageUrl ? { image: getProxiedImageUrl(r.imageUrl, "xs", { relative: true }) } : {}) })),
    })
    if (out.length >= limit) break
  }
  return out
}

// ── the constellation: who thanked whom ───────────────────────────────────

export interface GraphNode extends ScreenPerson {
  /** 0..1 across and down the drawing area. */
  x: number
  y: number
  /** Thank-yous given and received. */
  weight: number
}

export interface GraphEdge {
  from: string
  to: string
  /** The newest thank-you along this line. */
  at: number
}

/**
 * People and the thank-yous between them, laid out by a small force
 * simulation (deterministic: same data, same picture). The most thanked
 * and thanking people are kept, up to `maxNodes`.
 */
export function gratitudeGraph(praises: Praise[], { maxNodes = 16, iterations = 400 } = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const people = new Map<string, ScreenPerson & { weight: number }>()
  const bump = (p: ScreenPerson) => {
    const cur = people.get(p.id)
    if (cur) cur.weight++
    else people.set(p.id, { ...p, weight: 1 })
  }
  for (const p of praises) {
    bump(p.from)
    p.to.forEach(bump)
  }
  // Keep the busiest, but always the people of the newest thank-yous.
  const keep = new Set<string>()
  for (const p of praises.slice(0, 4)) [p.from, ...p.to.slice(0, 3)].forEach((x) => keep.size < maxNodes && keep.add(x.id))
  for (const p of [...people.values()].sort((a, b) => b.weight - a.weight)) if (keep.size < maxNodes) keep.add(p.id)

  const edges = new Map<string, GraphEdge>()
  for (const p of praises) {
    if (!keep.has(p.from.id)) continue
    for (const t of p.to) {
      if (!keep.has(t.id)) continue
      const key = `${p.from.id}>${t.id}`
      if (!edges.has(key)) edges.set(key, { from: p.from.id, to: t.id, at: p.at })
    }
  }

  const ids = [...keep]
  const n = ids.length
  // Start on a circle, in a stable order.
  const pos = ids.map((_, i) => ({ x: 0.5 + 0.35 * Math.cos((2 * Math.PI * i) / Math.max(1, n)), y: 0.5 + 0.35 * Math.sin((2 * Math.PI * i) / Math.max(1, n)) }))
  const index = new Map(ids.map((id, i) => [id, i]))
  const links = [...edges.values()].map((e) => [index.get(e.from)!, index.get(e.to)!] as const)
  for (let step = 0; step < iterations; step++) {
    const cool = 1 - step / iterations
    const force = pos.map(() => ({ x: 0, y: 0 }))
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x
        const dy = pos[i].y - pos[j].y
        const d2 = Math.max(dx * dx + dy * dy, 1e-4)
        const f = 0.0016 / d2
        force[i].x += dx * f
        force[i].y += dy * f
        force[j].x -= dx * f
        force[j].y -= dy * f
      }
    for (const [a, b] of links) {
      const dx = pos[b].x - pos[a].x
      const dy = pos[b].y - pos[a].y
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-3
      const f = (d - 0.24) * 0.08
      force[a].x += (dx / d) * f
      force[a].y += (dy / d) * f
      force[b].x -= (dx / d) * f
      force[b].y -= (dy / d) * f
    }
    for (let i = 0; i < n; i++) {
      force[i].x += (0.5 - pos[i].x) * 0.01
      force[i].y += (0.5 - pos[i].y) * 0.01
      const m = Math.min(0.05, Math.hypot(force[i].x, force[i].y)) * cool
      const len = Math.hypot(force[i].x, force[i].y) || 1
      pos[i].x = Math.min(0.94, Math.max(0.06, pos[i].x + (force[i].x / len) * m))
      pos[i].y = Math.min(0.9, Math.max(0.08, pos[i].y + (force[i].y / len) * m))
    }
  }
  const nodes = ids.map((id, i) => ({ ...people.get(id)!, x: pos[i].x, y: pos[i].y }))
  return { nodes, edges: [...edges.values()] }
}

export interface ContributionsScreenData {
  praises: Praise[]
  contributions: Contribution[]
}

export function loadContributionsScreen(now = new Date()): ContributionsScreenData {
  const months = lastMonths(now, 2)
  const read = (file: string) => months.map(([y, m]) => readTierJson<ChannelFeed>(TIER, file, y, m)).filter((f): f is ChannelFeed => !!f)
  const avatars = avatarsById()
  return {
    praises: recentPraises(read("praise.json"), { now: now.getTime(), avatars }),
    contributions: recentContributions(read("contributions.json"), { avatars }),
  }
}
