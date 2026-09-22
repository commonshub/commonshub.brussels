/**
 * Events managed by hand in settings.json, on top of what the chb pipeline
 * imports from the Commons Hub Luma calendar and the room calendars.
 *
 *   - featured: URLs to show in the "Featured" block on the homepage, whatever
 *     tags the event carries on Luma.
 *   - pinned: events that are not in the Luma calendar (yet) — created on
 *     someone's personal Luma calendar, say — listed until Luma has them. A
 *     pinned event with the same URL as an imported one steps aside for it.
 *
 * "Same URL" means the URL an event is listed under *or* any of its aliases:
 * an event we host has its own page (/events/<slug>) and keeps its Luma link
 * as an alias, so pinning that Luma URL does not list it a second time.
 */

import settings from "@/settings/settings.json"

export interface PinnedEvent {
  name: string
  url: string
  startAt: string
  endAt?: string
  coverImage?: string
  description?: string
  location?: string
}

export interface EventsConfig {
  featured?: string[]
  pinned?: PinnedEvent[]
}

/** A listed event, as the events API shapes it. Only what this module touches. */
export interface ListedEvent {
  id: string
  name: string
  description: string
  start_at: string
  end_at: string
  cover_url: string
  url: string
  location?: string
  isExternal: boolean
  externalPlatform?: string
  externalUrl?: string
  tags?: Array<{ name: string; color: string }>
  isFeatured?: boolean
  /** Other URLs that mean this same event (see mergeHostedEvents). */
  aliases?: string[]
}

const CONFIG = ((settings as { events?: EventsConfig }).events ?? {}) as EventsConfig

/** luma.com/x, lu.ma/x, trailing slash, http/https: all the same event. */
export function eventKey(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^lu\.ma\//, "luma.com/")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
}

function fromPinned(p: PinnedEvent): ListedEvent {
  return {
    id: `pinned:${eventKey(p.url)}`,
    name: p.name,
    description: p.description ?? "",
    start_at: p.startAt,
    end_at: p.endAt ?? "",
    cover_url: p.coverImage ?? "",
    url: p.url,
    location: p.location,
    isExternal: false,
    tags: [],
    isFeatured: false,
  }
}

/**
 * Add the pinned events that are still to come and not already imported,
 * mark the featured ones, and return the list sorted by start.
 */
export function applyHandManagedEvents(
  events: ListedEvent[],
  now: Date = new Date(),
  config: EventsConfig = CONFIG,
): ListedEvent[] {
  const featured = new Set((config.featured ?? []).map(eventKey))
  const keysOf = (e: ListedEvent) => [e.url, ...(e.aliases ?? [])].map(eventKey).filter(Boolean)
  const present = new Set(events.flatMap(keysOf))

  const extra = (config.pinned ?? [])
    .filter((p) => new Date(p.startAt) >= now && !present.has(eventKey(p.url)))
    .map(fromPinned)

  return [...events, ...extra]
    .map((e) => (keysOf(e).some((key) => featured.has(key)) ? { ...e, isFeatured: true } : e))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
}
