import type { Metadata } from "next"
import { notFound } from "next/navigation"
import QRCode from "qrcode"

import { ProgrammeBoard } from "@/components/screen/programme-board"
import { ScreenShell } from "@/components/screen/screen"
import { getHostedEvent } from "@/lib/hosted-events"
import { buildProgramme, parsePreviewTime, screenTournament } from "@/lib/programme-screen"

interface ScreenPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ at?: string }>
}

export async function generateMetadata({ params }: ScreenPageProps): Promise<Metadata> {
  const { slug } = await params
  const event = getHostedEvent(slug)
  return {
    title: event ? `${event.name}: programme on screen | Commons Hub Brussels` : "Event Not Found",
    robots: { index: false },
  }
}

function formatDay(date: string, timeZone: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone })
}

/**
 * A hosted event's programme for the hub's big screen. The sessions are the
 * event page's (src/settings/events/<slug>.json); the board highlights what is
 * on now and moves along by itself. ?at=2026-10-04T14:20 previews another time.
 */
export default async function EventScreenPage({ params, searchParams }: ScreenPageProps) {
  const { slug } = await params
  const event = getHostedEvent(slug)
  if (!event) notFound()

  const { at } = await searchParams
  const real = Date.now()
  const preview = parsePreviewTime(at, event)
  const now = preview ?? real
  const programme = buildProgramme(event, now)

  // Always the public address, whichever copy of the site is on the screen.
  const url = `https://commonshub.brussels/events/${event.slug}`
  const qrSvg = await QRCode.toString(`${url}#schedule`, { type: "svg", errorCorrectionLevel: "M", margin: 0 })
  const offsetMs = preview === null ? 0 : preview - real

  return (
    <ScreenShell title={event.name} subtitle={programme ? formatDay(programme.date, event.timezone) : undefined} clockOffsetMs={offsetMs}>
      {programme ? (
        <ProgrammeBoard slots={programme.slots} tournament={screenTournament(event)} offsetMs={offsetMs} qrSvg={qrSvg} url={url} />
      ) : (
        <div className="flex flex-1 items-center justify-center" style={{ fontSize: "calc(var(--s) * 3)" }}>
          The programme is not published yet.
        </div>
      )}
    </ScreenShell>
  )
}
