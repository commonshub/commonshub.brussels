import type { Metadata } from "next"

import { EVENT_DESIGNS, EventsScreen } from "./designs"

// Reads DATA_DIR, which is only mounted at runtime, and picks a design per request.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Upcoming events, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * For the hub's big screen: what's on, in one of three designs picked at
 * random each time the page loads (on /screen they take turns):
 * /events/screen/1 an agenda with the next event (or the featured one) up
 * front, /2 the next two weeks as a calendar, /3 the month ahead. Weekly events
 * (Heartbeat, park cleaning, potluck) are shown once, as recurring.
 */
export default function EventsScreenPage() {
  return <EventsScreen design={Math.floor(Math.random() * EVENT_DESIGNS.length)} />
}
