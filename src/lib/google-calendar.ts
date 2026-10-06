/**
 * Google Calendar, server side, as the Discord bot uses it: a service
 * account (GOOGLE_SERVICE_ACCOUNT_KEY, the JSON key, raw or base64) that the
 * shifts calendar is shared with. Adding attendees (so people get an
 * invite) needs domain-wide delegation: the account then acts as
 * GOOGLE_CALENDAR_IMPERSONATE_USER. No Google SDK: a signed JWT for a token,
 * then plain REST.
 */

import { createSign } from "crypto"

export interface GCalEvent {
  id?: string
  summary?: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  attendees?: Array<{ email: string; responseStatus?: string }>
}

interface ServiceAccount {
  client_email: string
  private_key: string
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")
    const key = JSON.parse(json) as ServiceAccount
    return key.client_email && key.private_key ? key : null
  } catch {
    return null
  }
}

export function isCalendarConfigured(): boolean {
  return !!serviceAccount()
}

const tokens = new Map<string, { token: string; exp: number }>()

async function accessToken(subject?: string): Promise<string> {
  const sa = serviceAccount()
  if (!sa) throw new Error("Google Calendar is not configured (GOOGLE_SERVICE_ACCOUNT_KEY)")
  const key = subject ?? ""
  const cached = tokens.get(key)
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const claims = { iss: sa.client_email, scope: "https://www.googleapis.com/auth/calendar", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600, ...(subject ? { sub: subject } : {}) }
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}`
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  })
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !body.access_token) throw new Error(`Google auth failed: ${body.error_description || res.status}`)
  tokens.set(key, { token: body.access_token, exp: Date.now() + (body.expires_in ?? 3600) * 1000 })
  return body.access_token
}

async function gcal<T>(path: string, init: RequestInit = {}, subject?: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken(subject)}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${body?.error?.message ?? ""}`)
  return body
}

const cal = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`

export async function listEvents(calendarId: string, from: Date, to: Date): Promise<GCalEvent[]> {
  const out: GCalEvent[] = []
  let pageToken: string | undefined
  do {
    const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250", ...(pageToken ? { pageToken } : {}) })
    const page = await gcal<{ items?: GCalEvent[]; nextPageToken?: string }>(`${cal(calendarId)}?${q}`)
    out.push(...(page.items ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return out
}

export function getEvent(calendarId: string, eventId: string): Promise<GCalEvent> {
  return gcal<GCalEvent>(`${cal(calendarId)}/${encodeURIComponent(eventId)}`)
}

/** Attendees get invites only with domain-wide delegation; without it the event is still written. */
const inviter = (withAttendees: boolean) => (withAttendees ? process.env.GOOGLE_CALENDAR_IMPERSONATE_USER || undefined : undefined)

export function insertEvent(calendarId: string, event: GCalEvent): Promise<GCalEvent> {
  const invites = !!event.attendees?.length && !!inviter(true)
  const body = invites ? event : { ...event, attendees: undefined }
  return gcal<GCalEvent>(`${cal(calendarId)}${invites ? "?sendUpdates=all" : ""}`, { method: "POST", body: JSON.stringify(body) }, inviter(invites))
}

export function patchEvent(calendarId: string, eventId: string, patch: Partial<GCalEvent>): Promise<GCalEvent> {
  const invites = !!patch.attendees?.length && !!inviter(true)
  const body = invites ? patch : { ...patch, attendees: undefined }
  return gcal<GCalEvent>(`${cal(calendarId)}/${encodeURIComponent(eventId)}${invites ? "?sendUpdates=all" : ""}`, { method: "PATCH", body: JSON.stringify(body) }, inviter(invites))
}
