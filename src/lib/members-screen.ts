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
export function ellipsePoints(count: number, r: number, phase = 0): Array<{ x: number; y: number }> {
  if (count <= 0) return []
  // Sample the ellipse in pixels of a 1920×1080 screen, then walk equal arc lengths.
  const ax = r * 0.48 * 1920
  const ay = r * 0.46 * 1080
  const N = 1440
  const pts = Array.from({ length: N + 1 }, (_, k) => {
    const t = phase + (k / N) * 2 * Math.PI
    return { t, x: Math.cos(t) * ax, y: Math.sin(t) * ay }
  })
  const cum = [0]
  for (let k = 1; k <= N; k++) cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y))
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
 * Partners on one inner ring; members spread over three outer rings in
 * proportion to each ring's length, so neighbours keep the same distance.
 */
export function membersCloud(partners: number, members: number): Array<{ x: number; y: number }> {
  const rings = [0.74, 0.87, 1]
  const weights = rings.map((r) => r)
  const sum = weights.reduce((a, b) => a + b, 0)
  const counts = weights.map((w) => Math.floor((members * w) / sum))
  for (let i = 0; counts.reduce((a, b) => a + b, 0) < members; i = (i + 1) % rings.length) counts[rings.length - 1 - i]++
  return [
    ...ellipsePoints(partners, 0.57, -Math.PI / 2),
    ...rings.flatMap((r, i) => ellipsePoints(counts[i], r, -Math.PI / 2 + (i * Math.PI) / Math.max(1, counts[i]))),
  ]
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
