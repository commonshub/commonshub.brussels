/**
 * /events/screen: the next events at the hub, for the big screen. Read from
 * the public tier's upcoming events (latest/public/events.json, the file the
 * homepage reads), the ones still to come or happening now, soonest first.
 */

import { readLatestEvents, type DatasetEvent } from "./dataset"
import { coverUrlFor } from "./event-cover"
import { getProxiedImageUrl } from "./image-proxy"

import type { ScreenEvent } from "./events-screen-format"

export { dayLabel, timeRange, type ScreenEvent } from "./events-screen-format"

/** An event without an end is taken to last two hours. */
const DEFAULT_MS = 2 * 3_600_000

export function upcomingScreenEvents(events: DatasetEvent[], now: number, limit = 8, cover: (e: DatasetEvent) => string = () => ""): ScreenEvent[] {
  const seen = new Set<string>()
  return events
    .map((e) => {
      const startMs = Date.parse(e.startAt)
      const endMs = e.endAt ? Date.parse(e.endAt) : startMs + DEFAULT_MS
      return { e, startMs, endMs: Number.isFinite(endMs) ? endMs : startMs + DEFAULT_MS }
    })
    .filter(({ e, startMs, endMs }) => Number.isFinite(startMs) && endMs > now && !!e.name && !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, limit)
    .map(({ e, startMs, endMs }) => ({ id: e.id, name: e.name, startMs, endMs, cover: cover(e) }))
}

export function loadScreenEvents(now = Date.now(), limit = 8): ScreenEvent[] {
  return upcomingScreenEvents(readLatestEvents("public"), now, limit, (e) => {
    const url = coverUrlFor(e as { coverImageLocal?: string; coverImage?: string })
    return url ? getProxiedImageUrl(url, "md", { relative: true }) : ""
  })
}
