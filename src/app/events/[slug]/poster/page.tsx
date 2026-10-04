import type { Metadata } from "next"
import { notFound } from "next/navigation"
import QRCode from "qrcode"

import { PosterLogo, posterPrintCss, u } from "@/components/poster/poster"
import { PrintButton } from "@/components/poster/print-button"
import { getHostedEvent } from "@/lib/hosted-events"
import { buildProgramme, screenTournament } from "@/lib/programme-screen"

// The day shown depends on today's date.
export const dynamic = "force-dynamic"

interface PosterPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PosterPageProps): Promise<Metadata> {
  const { slug } = await params
  const event = getHostedEvent(slug)
  return {
    title: event ? `${event.name}: programme poster | Commons Hub Brussels` : "Event Not Found",
    description: event ? `Print the A4 poster with the programme of ${event.name}.` : undefined,
    robots: { index: false },
  }
}

function formatDay(date: string, timeZone: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone })
}

/**
 * A hosted event's programme on an A4 poster: the day's sessions by start
 * time (today's day, or the next one with sessions, as on the big screen),
 * and a QR code to the event page. Black on white to save ink.
 */
export default async function EventPosterPage({ params }: PosterPageProps) {
  const { slug } = await params
  const event = getHostedEvent(slug)
  if (!event) notFound()

  const programme = buildProgramme(event, Date.now())
  const tournament = screenTournament(event)
  // Always the public address, whichever copy of the site prints the poster.
  const url = `https://commonshub.brussels/events/${event.slug}`
  const qr = await QRCode.toString(`${url}#schedule`, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#000000", light: "#0000" } })
  const sessions = programme?.slots.reduce((n, slot) => n + slot.sessions.length, 0) ?? 0
  // Squeeze a little when the day is full, so it always fits one page.
  const k = sessions > 16 ? 0.8 : sessions > 10 ? 0.9 : 1

  return (
    <div className="poster-sheet mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <style>{posterPrintCss("A4")}</style>

      <div className="print:hidden flex w-full flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{event.name}: programme poster</h1>
          <p className="text-sm text-muted-foreground">A4, black on white to save ink. Print it, or save it as a PDF from the print dialog.</p>
        </div>
        <PrintButton />
      </div>

      <div className="poster flex flex-col bg-white text-black shadow-sm ring-1 ring-black/10" style={{ width: u(210), height: u(297), padding: u(14) }}>
        <div className="flex items-center" style={{ gap: u(3.5) }}>
          <span className="shrink-0" style={{ width: u(11), height: u(11), display: "block" }}>
            <PosterLogo className="h-full w-full" />
          </span>
          <span style={{ fontSize: u(6.5), fontWeight: 600 }}>Commons Hub Brussels</span>
          <span className="ml-auto text-right" style={{ fontSize: u(3.6), lineHeight: 1.3 }}>
            Rue de la Madeleine 51
            <br />
            in front of Brussels Central
          </span>
        </div>

        <h2 style={{ marginTop: u(8), fontSize: u(event.name.length > 28 ? 12 : 15), lineHeight: 1.05, fontWeight: 700, letterSpacing: "-0.02em" }}>{event.name}</h2>
        {programme && <p style={{ marginTop: u(2.5), fontSize: u(6), fontWeight: 600 }}>{formatDay(programme.date, event.timezone)}</p>}
        {event.tagline && <p style={{ marginTop: u(1.5), fontSize: u(4.4), lineHeight: 1.3 }}>{event.tagline}</p>}

        {programme ? (
          <div style={{ marginTop: u(6), borderTop: `${u(0.4)} solid #000` }}>
            {programme.slots.map((slot) => (
              <div key={slot.start} className="flex" style={{ gap: u(4), padding: `${u(2.6 * k)} 0`, borderBottom: `${u(0.2)} solid #bbb` }}>
                <div className="shrink-0 tabular-nums" style={{ width: u(17), fontSize: u(5 * k), fontWeight: 700, lineHeight: 1.2 }}>
                  {slot.start}
                </div>
                <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: slot.sessions.length > 1 ? "1fr 1fr" : "1fr", columnGap: u(5), rowGap: u(2.2 * k) }}>
                  {slot.sessions.map((s) => (
                    <div key={`${s.room}-${s.title}`} className="min-w-0">
                      <div style={{ fontSize: u(4.3 * k), fontWeight: 600, lineHeight: 1.25 }}>{s.title}</div>
                      <div style={{ marginTop: u(0.6), fontSize: u(3.4 * k), lineHeight: 1.3, color: "#333" }}>
                        {[s.roomName, s.speakers.join(", ")].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: u(12), fontSize: u(6) }}>The programme is not published yet.</p>
        )}

        <div className="mt-auto flex items-end" style={{ gap: u(6), paddingTop: u(5) }}>
          <div className="min-w-0 flex-1" style={{ fontSize: u(4), lineHeight: 1.35 }}>
            {tournament && (
              <p style={{ marginBottom: u(3) }}>
                <span style={{ fontWeight: 700 }}>
                  {tournament.name}, {tournament.start}–{tournament.end}
                </span>
                {event.tournament?.teamSize ? ` · teams of ${event.tournament.teamSize}, sign up on the event page` : ""}
              </p>
            )}
            <p style={{ fontSize: u(5), fontWeight: 700 }}>Scan for the full programme</p>
            <p>commonshub.brussels/events/{event.slug}</p>
          </div>
          <div className="shrink-0" style={{ width: u(36), height: u(36) }} dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </div>
    </div>
  )
}
