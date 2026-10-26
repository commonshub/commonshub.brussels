/**
 * Who came to the hub today, as the door server (door.commonshub.brussels)
 * knows it: everyone the door let in since midnight in Brussels, from its
 * public log (/log.json), with their Discord avatar when its home page shows
 * one. For the member dashboard, after a member opens the door.
 */

import { DOOR_URL } from "./door-link"

export interface DoorVisitor {
  name: string
  /** Milliseconds: when the door first let them in today. */
  arrivedAt: number
  avatar: string | null
  /** In with a link someone gave them (a guest pass, a room booking), not as a member. */
  guest: boolean
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
    })
  }
  return [...byKey.values()].sort((a, b) => a.arrivedAt - b.arrivedAt)
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
  return todaysVisitors(sorted, avatarsFromHome(home), now, me)
}
