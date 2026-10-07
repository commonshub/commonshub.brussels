/**
 * /events/screen: what's on at the hub, for the big screen, in three designs
 * (an agenda with the next event up front, two weeks as a calendar, a
 * timeline). They share this data:
 *
 * - one-off events still to come, from the public tier (latest/public/
 *   events.json, the homepage's), soonest first;
 * - the weekly events (settings.json events.recurring: Monday's Heartbeat,
 *   Friday's park cleaning and potluck), shown once as recurring instead of
 *   once per week: events whose name matches them are left out of the list;
 * - the next featured event: one we host ourselves, with its own page
 *   (src/settings/events), as /events features them.
 */

import settings from "@/settings/settings.json"

import { readLatestEvents, type DatasetEvent } from "./dataset"
import { coverUrlFor } from "./event-cover"
import { hostedEvents, type HostedEvent } from "./hosted-events"
import { getProxiedImageUrl } from "./image-proxy"
import { nextOccurrence, type BoardData, type BoardEvent, type Recurring } from "./events-board-format"

export * from "./events-board-format"

/** An event without an end is taken to last two hours. */
const DEFAULT_MS = 2 * 3_600_000

export const RECURRING: Recurring[] = ((settings.events as { recurring?: Recurring[] }).recurring ?? []).filter((r) => r.match)

/** Is this event one of the weekly ones? */
export const isRecurring = (name: string, recurring: Recurring[] = RECURRING) => recurring.some((r) => new RegExp(r.match, "i").test(name))

/** One-off events not over yet, soonest first, each once, within `days`. */
export function boardEvents(
  events: DatasetEvent[],
  now: number,
  { days = 60, recurring = RECURRING, cover = () => "" }: { days?: number; recurring?: Recurring[]; cover?: (e: DatasetEvent) => string } = {},
): BoardEvent[] {
  const seen = new Set<string>()
  const until = now + days * 86_400_000
  return events
    .map((e) => {
      const startMs = Date.parse(e.startAt)
      const end = e.endAt ? Date.parse(e.endAt) : NaN
      return { e, startMs, endMs: Number.isFinite(end) ? end : startMs + DEFAULT_MS }
    })
    .filter(({ e, startMs, endMs }) => Number.isFinite(startMs) && endMs > now && startMs < until && !!e.name && !isRecurring(e.name, recurring) && !seen.has(e.id) && !!seen.add(e.id))
    .sort((a, b) => a.startMs - b.startMs)
    .map(({ e, startMs, endMs }) => ({ id: e.id, name: e.name, startMs, endMs, cover: cover(e) }))
}

/** The next event we host ourselves (featured on /events), if any is still to come. */
export function nextFeatured(hosted: HostedEvent[], now: number): BoardEvent | null {
  const upcoming = hosted
    .filter((h) => h.featured !== false && Date.parse(h.endAt) > now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0]
  if (!upcoming) return null
  const cover = upcoming.coverImage ? getProxiedImageUrl(upcoming.coverImage, "lg", { relative: true }) : ""
  return { id: `hosted-${upcoming.slug}`, name: upcoming.name, startMs: Date.parse(upcoming.startAt), endMs: Date.parse(upcoming.endAt), cover, tagline: upcoming.tagline, featured: true }
}

export function loadBoard(now = Date.now()): BoardData {
  const events = boardEvents(readLatestEvents("public"), now, {
    cover: (e) => {
      const url = coverUrlFor(e as { coverImageLocal?: string; coverImage?: string })
      return url ? getProxiedImageUrl(url, "md", { relative: true }) : ""
    },
  })
  const featured = nextFeatured(hostedEvents, now)
  return {
    now,
    // A featured event that is also in the calendar is the same event: keep one.
    events: featured ? events.filter((e) => e.name !== featured.name) : events,
    featured,
    recurring: RECURRING.map((r) => ({ ...r, nextMs: nextOccurrence(r, now) })),
  }
}

