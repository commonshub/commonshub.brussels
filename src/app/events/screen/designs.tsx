import QRCode from "qrcode"

import { AgendaDesign, MonthDesign, WeeksDesign } from "@/components/screen/events-designs"
import { ScreenShell } from "@/components/screen/screen"
import { loadBoard } from "@/lib/events-board"

/** Always the public address, whichever copy of the site is on the screen. */
export const EVENTS_URL = "https://commonshub.brussels/events"

const qr = () => QRCode.toString(EVENTS_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0 })

/** The three designs of /events/screen (see components/screen/events-designs.tsx). */
export const EVENT_DESIGNS = [
  { title: "What's on at the hub", Design: AgendaDesign },
  { title: "The next two weeks", Design: WeeksDesign },
  { title: "The month ahead", Design: MonthDesign },
] as const

export async function EventsScreen({ design }: { design: number }) {
  const { title, Design } = EVENT_DESIGNS[design] ?? EVENT_DESIGNS[0]
  return (
    <ScreenShell title={title}>
      <Design data={loadBoard()} qrSvg={await qr()} url={EVENTS_URL} />
    </ScreenShell>
  )
}
