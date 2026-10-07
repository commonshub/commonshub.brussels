/**
 * The Luma calendar API (https://public-api.luma.com, its current /v1 paths),
 * for what Elinor does through /mcp: list and look up the events of our
 * calendar, add a member's event to it, create one. The calendar the API key
 * belongs to is ours (settings.json luma.calendarId).
 *
 * Hosts come back with their emails from Luma; what leaves this module only
 * keeps their names (an assistant posting in a Discord channel should not
 * pass emails around).
 */

const BASE = "https://public-api.luma.com"

/** The hub, as Luma knows it (its Google Maps place): the default place of an event created here. */
export const HUB_PLACE = { type: "google", place_id: "ChIJW1TGSoDFw0cRDKClyTpP0AQ" } as const
export const TIMEZONE = "Europe/Brussels"

export class LumaError extends Error {}

function key(): string {
  const k = process.env.LUMA_API_KEY
  if (!k) throw new LumaError("LUMA_API_KEY is not set")
  return k
}

async function lumaFetch<T>(path: string, init: { method?: "GET" | "POST"; query?: Record<string, string | string[] | undefined>; body?: unknown } = {}): Promise<T> {
  const url = new URL(path, BASE)
  for (const [k, v] of Object.entries(init.query ?? {})) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) url.searchParams.append(k, one)
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { accept: "application/json", "x-luma-api-key": key(), ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const text = await res.text()
  if (!res.ok) throw new LumaError(`Luma ${res.status}: ${text.slice(0, 300)}`)
  return (text ? JSON.parse(text) : {}) as T
}

interface RawEvent {
  id: string
  name: string
  start_at: string
  end_at?: string
  timezone?: string
  url?: string
  visibility?: string
  access?: "manage" | "view"
  max_capacity?: number | null
  spots_remaining?: number | null
  registration_open?: boolean
  require_approval?: boolean
  geo_address_json?: { full_address?: string; address?: string; description?: string } | null
  location_type?: string
  description_md?: string
  hosts?: Array<{ name?: string; first_name?: string; last_name?: string; avatar_url?: string }>
  guest_counts?: Record<string, { guests?: number; tickets?: number }>
}

export interface EventSummary {
  id: string
  name: string
  start: string
  end?: string
  url?: string
  /** "ours" when the hub's calendar manages it, "listed" when it is someone else's event shown on our calendar. */
  calendar: "ours" | "listed"
  where?: string
  capacity?: number | null
  spotsLeft?: number | null
}

export interface EventDetails extends EventSummary {
  description?: string
  visibility?: string
  registrationOpen?: boolean
  requiresApproval?: boolean
  /** Who organises it: names only. */
  organizers: Array<{ name: string; avatar?: string }>
  /** Registrations by status: approved (going), pending approval, waitlist, invited, declined, checked in. */
  participants: Record<string, number>
}

const summary = (e: RawEvent): EventSummary => ({
  id: e.id,
  name: e.name,
  start: e.start_at,
  ...(e.end_at ? { end: e.end_at } : {}),
  ...(e.url ? { url: e.url } : {}),
  calendar: e.access === "view" ? "listed" : "ours",
  ...(e.geo_address_json?.full_address || e.geo_address_json?.address ? { where: e.geo_address_json.full_address || e.geo_address_json.address } : {}),
  capacity: e.max_capacity ?? null,
  spotsLeft: e.spots_remaining ?? null,
})

/** Events on our calendar (ours and the ones listed on it), upcoming soonest first, or past latest first. */
export async function listEvents({ when = "upcoming", after, before, limit = 20 }: { when?: "upcoming" | "past"; after?: string; before?: string; limit?: number } = {}): Promise<EventSummary[]> {
  const now = new Date().toISOString()
  const out: EventSummary[] = []
  let cursor: string | undefined
  do {
    const page = await lumaFetch<{ entries: Array<RawEvent | { event: RawEvent }>; has_more?: boolean; next_cursor?: string }>("/v1/calendars/events/list", {
      query: {
        access: ["manage", "view"],
        after: after ?? (when === "upcoming" ? now : undefined),
        before: before ?? (when === "past" ? now : undefined),
        sort_direction: when === "past" ? "desc" : "asc",
        pagination_limit: String(Math.min(50, limit)),
        pagination_cursor: cursor,
      },
    })
    for (const entry of page.entries ?? []) out.push(summary("event" in entry ? entry.event : entry))
    cursor = page.has_more ? page.next_cursor : undefined
  } while (cursor && out.length < limit)
  return out.slice(0, limit)
}

/** An event id ("evt-…") from an id or a luma.com / lu.ma link (read from the event's public page). */
export async function resolveEventId(eventOrUrl: string): Promise<string> {
  const input = eventOrUrl.trim()
  if (/^evt-[A-Za-z0-9]+$/.test(input)) return input
  if (!/^https:\/\/(?:www\.)?(?:luma\.com|lu\.ma)\/[\w-]+/.test(input)) throw new LumaError("Give an event id (evt-…) or its luma.com link")
  const html = await (await fetch(input, { cache: "no-store" })).text()
  const id = html.match(/evt-[A-Za-z0-9]{10,24}/)?.[0]
  if (!id) throw new LumaError(`No Luma event found at ${input}`)
  return id
}

export async function getEventDetails(eventOrUrl: string): Promise<EventDetails> {
  const id = await resolveEventId(eventOrUrl)
  const e = await lumaFetch<RawEvent>("/v1/events/get", { query: { event_id: id } })
  const counts: Record<string, number> = {}
  for (const [status, c] of Object.entries(e.guest_counts ?? {})) counts[status] = c?.guests ?? 0
  return {
    ...summary(e),
    ...(e.description_md ? { description: e.description_md.slice(0, 2000) } : {}),
    visibility: e.visibility,
    registrationOpen: e.registration_open,
    requiresApproval: e.require_approval,
    organizers: (e.hosts ?? []).map((h) => ({ name: h.name || [h.first_name, h.last_name].filter(Boolean).join(" ") || "Host", ...(h.avatar_url ? { avatar: h.avatar_url } : {}) })),
    participants: counts,
  }
}

/** Is it on our calendar already? */
export async function lookupOnCalendar(eventId: string): Promise<boolean> {
  try {
    const found = await lumaFetch<{ event?: unknown } | null>("/v1/calendars/events/lookup", { query: { platform: "luma", event_id: eventId } })
    return !!found && !!(found as { event?: unknown }).event
  } catch {
    return false
  }
}

/**
 * Put an existing event on our calendar: a Luma event (by id or link), or one
 * elsewhere (url, name, start, duration). `approve` false leaves it pending
 * for a calendar admin.
 */
export async function addToCalendar(
  input: { event: string } | { url: string; name: string; start: string; durationMinutes: number },
  approve: boolean,
): Promise<{ eventId?: string; status: "added" | "pending" }> {
  const submission_mode = approve ? "auto" : "pending"
  if ("event" in input) {
    const eventId = await resolveEventId(input.event)
    await lumaFetch("/v1/calendars/events/add", { method: "POST", body: { platform: "luma", event_id: eventId, submission_mode } })
    return { eventId, status: approve ? "added" : "pending" }
  }
  const hours = Math.floor(input.durationMinutes / 60)
  const minutes = input.durationMinutes % 60
  await lumaFetch("/v1/calendars/events/add", {
    method: "POST",
    body: { platform: "external", submission_mode, url: input.url, name: input.name, start_at: input.start, duration_interval: `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}` || "PT1H", timezone: TIMEZONE },
  })
  return { status: approve ? "added" : "pending" }
}

/** Create an event on our calendar, at the hub unless told otherwise, with the member as its host. */
export async function createEvent(input: {
  name: string
  start: string
  end?: string
  description?: string
  visibility?: "public" | "members-only" | "private"
  capacity?: number
  hostEmail?: string
  hostName?: string
  address?: string
}): Promise<{ eventId: string; url?: string }> {
  const created = await lumaFetch<{ api_id?: string; id?: string; event?: { id?: string; url?: string }; url?: string }>("/v1/events/create", {
    method: "POST",
    body: {
      name: input.name,
      start_at: input.start,
      ...(input.end ? { end_at: input.end } : {}),
      timezone: TIMEZONE,
      ...(input.description ? { description_md: input.description } : {}),
      visibility: input.visibility ?? "public",
      ...(input.capacity ? { max_capacity: input.capacity } : {}),
      geo_address_json: input.address ? { type: "lookup", query: input.address } : HUB_PLACE,
    },
  })
  const eventId = created.event?.id ?? created.id ?? created.api_id ?? ""
  if (!eventId) throw new LumaError("Luma did not return the new event's id")
  if (input.hostEmail) {
    await lumaFetch("/v1/events/hosts/add", { method: "POST", body: { event_id: eventId, email: input.hostEmail, ...(input.hostName ? { name: input.hostName } : {}), access_level: "manager" } })
  }
  return { eventId, url: created.event?.url ?? created.url }
}
