import type { Metadata } from "next"
import QRCode from "qrcode"

import { EventsBoard } from "@/components/screen/events-board"
import { ScreenShell } from "@/components/screen/screen"
import { loadScreenEvents } from "@/lib/events-screen"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Upcoming events, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/** Always the public address, whichever copy of the site is on the screen. */
const EVENTS_URL = "https://commonshub.brussels/events"

/** For the hub's big screen: the next eight events, and a QR code to /events. */
export default async function EventsScreenPage() {
  const qrSvg = await QRCode.toString(EVENTS_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0 })
  return (
    <ScreenShell title="Upcoming events">
      <EventsBoard events={loadScreenEvents()} qrSvg={qrSvg} url={EVENTS_URL} />
    </ScreenShell>
  )
}
