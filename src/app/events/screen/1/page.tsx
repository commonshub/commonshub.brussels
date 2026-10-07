import type { Metadata } from "next"

import { EventsScreen } from "../designs"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Upcoming events, on screen | Commons Hub Brussels",
  robots: { index: false },
}

export default function EventsScreen1() {
  return <EventsScreen design={0} />
}
