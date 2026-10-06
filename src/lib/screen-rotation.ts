import { hostedEventPath, hostedEvents, type HostedEvent } from "./hosted-events"

/**
 * /screen: what the hub's big screen cycles through. Today's hosted events
 * first (their programme screens), then the upcoming events, the community
 * and contribution screens, and the thank-yous (one of two designs, picked at
 * random each time that slide loads).
 */
export interface ScreenSlide {
  path: string
  /** How long it stays on, in seconds. */
  seconds: number
}

const dayIn = (ms: number, timeZone: string) => new Date(ms).toLocaleDateString("en-CA", { timeZone })

/** The hosted events with sessions today (in each event's own timezone). */
export function todaysEvents(now: number, events: HostedEvent[] = hostedEvents): HostedEvent[] {
  return events.filter((event) => {
    const tz = event.timezone || "Europe/Brussels"
    const today = dayIn(now, tz)
    const firstDay = dayIn(Date.parse(event.startAt), tz)
    const days = new Set(event.sessions.length ? event.sessions.map((s) => s.date || firstDay) : [firstDay])
    return days.has(today)
  })
}

/** Today's event screens (shown longer), then upcoming events, members and contribute. */
export function screenSlides(now: number, every = 30, events: HostedEvent[] = hostedEvents): ScreenSlide[] {
  return [
    ...todaysEvents(now, events).map((event) => ({ path: `${hostedEventPath(event)}/screen`, seconds: every * 2 })),
    { path: "/events/screen", seconds: every },
    { path: "/members/screen", seconds: every },
    { path: "/contribute/screen", seconds: every },
    { path: "/contributions/screen", seconds: every },
  ]
}
