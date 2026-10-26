/**
 * Who came to the hub today, as the door server (door.commonshub.brussels)
 * knows it: everyone the door let in since midnight in Brussels, from its
 * public log (/log.json), with their Discord avatar when its home page shows
 * one, and what they last shared in #contributions (chb's public feed). For
 * the member dashboard, after a member opens the door.
 */

import { lastMonths } from "./contribute-screen"
import { clip, plainText, type ChannelFeed } from "./contributions-screen"
import { readTierJson } from "./dataset"
import { DOOR_URL } from "./door-link"

export interface DoorVisitor {
  name: string
  /** Milliseconds: when the door first let them in today. */
  arrivedAt: number
  avatar: string | null
  /** In with a link someone gave them (a guest pass, a room booking), not as a member. */
  guest: boolean
  /** Their Discord id, when the door knows it. */
  id?: string
  /** What they last logged in #contributions (the last few months). */
  lastContribution?: { text: string; at: number }
}

export interface DoorLogEntry {
  timestamp: string
  status?: string
  name?: string
  method?: string
  userId?: string
  username?: string
  reason?: string
}

const day = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })

/** Discord avatars on the door's home page, by Discord user id. */
export function avatarsFromHome(html: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of html.matchAll(/https:\/\/cdn\.discordapp\.com\/avatars\/(\d+)\/([\w-]+)\.(?:webp|png|jpg|gif)/g)) out.set(m[1], `https://cdn.discordapp.com/avatars/${m[1]}/${m[2]}.png?size=96`)
  return out
}

/**
 * Today's visitors, first arrival first, each once. The member who just
 * opened from the website is logged under their username by a signed link:
 * `me` lets them show with their own avatar.
 */
export function todaysVisitors(log: DoorLogEntry[], avatars: Map<string, string>, now: Date, me?: { username: string; avatar: string | null }): DoorVisitor[] {
  const today = day(now.getTime())
  const byKey = new Map<string, DoorVisitor>()
  for (const e of log) {
    const at = Date.parse(e.timestamp)
    const name = (e.name || e.username || "").trim()
    if (e.status !== "granted" || !name || !Number.isFinite(at) || day(at) !== today || /^token user$/i.test(name)) continue
    const isMe = !!me && (name === me.username || e.username === me.username)
    const key = e.userId || (isMe ? `me` : name.toLowerCase())
    if (byKey.has(key)) continue
    const viaLink = e.method === "signature"
    byKey.set(key, {
      name,
      arrivedAt: at,
      avatar: (e.userId && avatars.get(e.userId)) || (isMe ? me!.avatar : null),
      guest: viaLink && !isMe && !/member/i.test(e.reason ?? ""),
      ...(e.userId ? { id: e.userId } : {}),
    })
  }
  return [...byKey.values()].sort((a, b) => a.arrivedAt - b.arrivedAt)
}

/** Each visitor's latest contribution, matched by Discord id, else by name. */
export function withLastContribution(visitors: DoorVisitor[], feeds: ChannelFeed[]): DoorVisitor[] {
  const latest = new Map<string, { text: string; at: number }>()
  for (const m of feeds.flatMap((f) => f.messages ?? [])) {
    const at = Date.parse(m.timestamp)
    const text = clip(plainText(m.content).replace(/@(\S)/g, "$1"), 90)
    if (!Number.isFinite(at) || !text) continue
    for (const k of [m.author?.id, m.author?.displayName?.toLowerCase(), m.author?.username?.toLowerCase()]) {
      if (k && (latest.get(k)?.at ?? 0) < at) latest.set(k, { text, at })
    }
  }
  return visitors.map((v) => {
    const found = (v.id && latest.get(v.id)) || latest.get(v.name.toLowerCase())
    return found ? { ...v, lastContribution: found } : v
  })
}

export async function loadDoorVisitors(me?: { username: string; avatar: string | null }, now = new Date()): Promise<DoorVisitor[]> {
  const get = (path: string) => fetch(`${DOOR_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(5000) })
  const [log, home] = await Promise.all([
    get("/log.json")
      .then((r) => r.json() as Promise<{ granted?: DoorLogEntry[] }>)
      .catch(() => ({ granted: [] })),
    get("/")
      .then((r) => r.text())
      .catch(() => ""),
  ])
  // The log is oldest first; the first entry of the day is the arrival.
  const sorted = [...(log.granted ?? [])].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  const feeds = lastMonths(now, 3)
    .map(([y, m]) => readTierJson<ChannelFeed>("public", "contributions.json", y, m))
    .filter((f): f is ChannelFeed => !!f)
  return withLastContribution(todaysVisitors(sorted, avatarsFromHome(home), now, me), feeds)
}
