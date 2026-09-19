/**
 * Events the Commons Hub hosts itself and gives a page of its own
 * (/events/<slug>): Open Commons Day, Open Source Village, ...
 *
 * Each one is a JSON file in src/settings/events/. Add a new event by adding
 * a file there and importing it below.
 */
import ocd2026 from "@/settings/events/ocd-2026.json";
import osv2027 from "@/settings/events/osv-2027.json";

export interface EventTag {
  name: string;
  color: string;
}

export interface HostedSession {
  /** YYYY-MM-DD; only needed for events longer than a day. */
  date?: string;
  /** HH:MM, local time of the event. */
  start: string;
  end?: string;
  /** Room slug from src/settings/rooms.json. */
  room?: string;
  title: string;
  speakers?: string[];
  description?: string;
  url?: string;
}

export interface TournamentMatch {
  /** HH:MM */
  time: string;
  round: string;
  teamA: string;
  teamB: string;
  score?: string | null;
}

export interface HostedTournament {
  name: string;
  start: string;
  end: string;
  teamSize: number;
  maxTeams?: number;
  fee: { amount: number; currency: string; per: string };
  payment: string;
  signupUrl: string;
  rules?: string[];
  /** Live bracket (e.g. Kickertool or Challonge) once the draw is made. */
  bracketUrl?: string | null;
  matches?: TournamentMatch[];
}

export interface RelatedEvent {
  date: string;
  title: string;
  speakers?: string[];
  url: string;
}

export interface HostedEvent {
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  /** ISO 8601 with offset. */
  startAt: string;
  endAt: string;
  timezone: string;
  location: string;
  coverImage?: string;
  /** CSS aspect-ratio of the cover, e.g. "1200 / 630"; square by default. */
  coverAspectRatio?: string;
  featured?: boolean;
  tags?: EventTag[];
  links: { luma?: string; website?: string };
  /** Luma api_id, to recognise this event in the Luma calendar feed. */
  lumaEventId?: string;
  sessions: HostedSession[];
  relatedEvents?: RelatedEvent[];
  tournament?: HostedTournament;
}

/** The event shape served by /api/events to the homepage. */
export interface HomepageEvent {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  cover_url: string;
  url: string;
  location?: string;
  isExternal: boolean;
  externalPlatform?: string;
  externalUrl?: string;
  tags?: EventTag[];
  isFeatured?: boolean;
}

export const hostedEvents: HostedEvent[] = [ocd2026, osv2027] as HostedEvent[];

export function getHostedEvent(slug: string): HostedEvent | undefined {
  return hostedEvents.find((event) => event.slug === slug);
}

export function hostedEventPath(event: HostedEvent): string {
  return `/events/${event.slug}`;
}

/** The last path segment of a Luma URL: https://luma.com/l9275g9x -> l9275g9x */
function lumaSlug(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname, pathname } = new URL(url);
    if (!/(^|\.)(lu\.ma|luma\.com)$/.test(hostname)) return null;
    return pathname.split("/").filter(Boolean).pop() || null;
  } catch {
    return null;
  }
}

function isSameEvent(hosted: HostedEvent, event: HomepageEvent): boolean {
  if (hosted.lumaEventId && event.id === hosted.lumaEventId) return true;
  const slug = lumaSlug(hosted.links.luma);
  return !!slug && lumaSlug(event.url) === slug;
}

/**
 * Point the homepage list at our own pages for hosted events: a hosted event
 * already in the Luma feed links to /events/<slug> instead of Luma, and one
 * that is not in the feed (Open Source Village) is added. Hosted events stay
 * listed until they end, so a multi-day event still shows while it runs.
 */
export function mergeHostedEvents(
  events: HomepageEvent[],
  now: Date = new Date(),
  hosted: HostedEvent[] = hostedEvents
): HomepageEvent[] {
  const merged = [...events];

  for (const event of hosted) {
    if (new Date(event.endAt) < now) continue;

    const url = hostedEventPath(event);
    const index = merged.findIndex((e) => isSameEvent(event, e));

    if (index >= 0) {
      const existing = merged[index];
      merged[index] = {
        ...existing,
        name: event.name,
        url,
        isExternal: false,
        externalPlatform: undefined,
        externalUrl: undefined,
        isFeatured: existing.isFeatured || !!event.featured,
      };
      continue;
    }

    merged.push({
      id: `hosted-${event.slug}`,
      name: event.name,
      description: event.tagline || event.description,
      start_at: event.startAt,
      end_at: event.endAt,
      cover_url: event.coverImage || "",
      url,
      isExternal: false,
      tags: event.tags || [],
      isFeatured: !!event.featured,
    });
  }

  return merged.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
}
