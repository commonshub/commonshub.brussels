import partnersData from "@/settings/partners.json"

import type { Tier } from "./data-paths"
import { isExcludedContributor, normalizeContributor, type ContributorsFile } from "./contributors"
import { listYears, readTierJson } from "./dataset"

/**
 * /members/screen: the hub's logo surrounded by a cloud of its partner
 * organisations' logos and its members' avatars. Public data only: partners
 * from settings/partners.json, and the Discord avatars chb publishes in the
 * public tier's contributors.json (yearly and lifetime), the same people
 * /community shows.
 */
const TIER: Tier = "public"

export interface CloudItem {
  kind: "partner" | "member"
  id: string
  name: string
  image: string
}

/** Members with an avatar, most active first, each once, bots and the hub's own account left out. */
export function memberAvatars(files: ContributorsFile[], limit = 90): CloudItem[] {
  const byId = new Map<string, { item: CloudItem; score: number }>()
  for (const file of files) {
    for (const raw of file.contributors ?? []) {
      const c = normalizeContributor(raw)
      if (!c.id || !c.avatar || isExcludedContributor(c)) continue
      const entry = byId.get(c.id) ?? { item: { kind: "member", id: c.id, name: c.displayName, image: c.avatar }, score: 0 }
      entry.score += c.contributionCount
      entry.item.image = c.avatar
      byId.set(c.id, entry)
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((e) => e.item)
}

export function partnerLogos(): CloudItem[] {
  return (partnersData as Array<{ name: string; logo?: string }>)
    .filter((p) => p.logo)
    .map((p) => ({ kind: "partner", id: `partner:${p.name}`, name: p.name, image: p.logo! }))
}

/**
 * Where items sit, as percentages of a 16:9 screen: a golden-angle spiral in
 * a band of normalised radii (0 = centre, 1 = screen edge; radius 1 is 48% of
 * the width and 46% of the height, an ellipse that fills the screen).
 * Partners (larger) get an inner band, members the outer one, so sizes do not
 * collide; the centre stays free for the logo.
 */
export function cloudLayout(count: number, band: [number, number] = [0.55, 0.96], phase = 0): Array<{ x: number; y: number }> {
  const [from, to] = band
  const golden = Math.PI * (3 - Math.sqrt(5))
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1)
    const r = from + (to - from) * Math.sqrt(t)
    const a = phase + i * golden
    out.push({ x: 50 + Math.cos(a) * r * 48, y: 50 + Math.sin(a) * r * 46 })
  }
  return out
}

/** Points at equal distances along an ellipse of normalised radius r (screen percentages, 16:9). */
export function ellipsePoints(count: number, r: number, phase = 0, free: (p: { x: number; y: number }) => boolean = () => true): Array<{ x: number; y: number }> {
  if (count <= 0) return []
  // Sample the ellipse in pixels of a 1920×1080 screen, then walk equal arc lengths.
  const ax = r * 0.48 * 1920
  const ay = r * 0.46 * 1080
  const N = 1440
  const pts = Array.from({ length: N + 1 }, (_, k) => {
    const t = phase + (k / N) * 2 * Math.PI
    return { t, x: Math.cos(t) * ax, y: Math.sin(t) * ay }
  })
  // Only the stretches of the ring that are free (not under a caption or the QR code) count.
  const pct = (k: number) => ({ x: 50 + (pts[k].x / 1920) * 100, y: 50 + (pts[k].y / 1080) * 100 })
  const cum = [0]
  for (let k = 1; k <= N; k++) cum.push(cum[k - 1] + (free(pct(k)) ? Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y) : 0))
  const total = cum[N]
  const out: Array<{ x: number; y: number }> = []
  let k = 0
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total
    while (k < N && cum[k + 1] < target) k++
    out.push({ x: 50 + (pts[k].x / 1920) * 100, y: 50 + (pts[k].y / 1080) * 100 })
  }
  return out
}

/**
 * Partners on two levels: placed along one ring, then every other one is
 * moved in or out, square to the ring, so each sits between two on the other
 * level and the two levels run parallel. Members spread over three outer
 * rings in proportion to each ring's length, so neighbours keep the same
 * distance.
 */
export function membersCloud(
  partners: number,
  members: number,
  {
    middle = 0.58,
    offset = 0.03,
    rings = [0.77, 0.885, 1],
    partnerSize = 5.4,
    memberSize = 3.15,
  }: { middle?: number; offset?: number; rings?: number[]; partnerSize?: number; memberSize?: number } = {},
): Array<{ x: number; y: number }> {
  const sum = rings.reduce((a, b) => a + b, 0)
  const counts = rings.map((r) => Math.floor((members * r) / sum))
  for (let i = 0; counts.reduce((a, b) => a + b, 0) < members; i = (i + 1) % rings.length) counts[rings.length - 1 - i]++
  // Work in pixels of a 1920×1080 screen; sizes are in screen units (1% of the width), `offset` is a share of the width.
  const U = 19.2
  const toPx = ({ x, y }: { x: number; y: number }) => ({ x: (x / 100) * 1920, y: (y / 100) * 1080 })
  const ax = middle * 0.48 * 1920
  const ay = middle * 0.46 * 1080
  const d = offset * 1920
  const partnerSpots = ellipsePoints(partners, middle, -Math.PI / 2).map(({ x, y }, i) => {
    const px = ((x - 50) / 100) * 1920
    const py = ((y - 50) / 100) * 1080
    const nx = px / (ax * ax)
    const ny = py / (ay * ay)
    const len = Math.hypot(nx, ny) || 1
    const sign = i % 2 === 0 ? -1 : 1
    return { x: 50 + ((px + (sign * d * nx) / len) / 1920) * 100, y: 50 + ((py + (sign * d * ny) / len) / 1080) * 100 }
  })
  // Everything placed so far, with its radius in px: each members ring leaves out the stretches that would touch it.
  const placed = partnerSpots.map((p) => ({ ...toPx(p), r: (partnerSize * U) / 2 }))
  const memberR = (memberSize * U) / 2
  const gap = 0.5 * U
  const memberSpots: Array<{ x: number; y: number }> = []
  rings.forEach((r, i) => {
    const before = placed.length
    // The bottom corners carry the counts (left) and the QR code (right), the top-right one the clock.
    const free = (p: { x: number; y: number }) => {
      if ((p.x > 60 && p.y > 76) || (p.x < 20 && p.y > 85) || (p.x > 86 && p.y < 13)) return false
      const q = toPx(p)
      return placed.slice(0, before).every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= o.r + memberR + gap)
    }
    for (const p of ellipsePoints(counts[i], r, -Math.PI / 2 + (i * Math.PI) / Math.max(1, counts[i]), free)) {
      memberSpots.push(p)
      placed.push({ ...toPx(p), r: memberR })
    }
  })
  return [...partnerSpots, ...memberSpots]
}

export function loadMembersScreen(): { items: CloudItem[]; members: number; partners: number } {
  const files = [
    readTierJson<ContributorsFile>(TIER, "contributors.json"),
    ...listYears().map((year) => readTierJson<ContributorsFile>(TIER, "contributors.json", year)),
  ].filter((f): f is ContributorsFile => !!f)
  const partners = partnerLogos()
  const members = memberAvatars(files)
  // Partners first (inner rings), then members.
  return { items: [...partners, ...members], members: members.length, partners: partners.length }
}
