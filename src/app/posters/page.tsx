import type { Metadata } from "next"
import Link from "next/link"

import { PosterLogo } from "@/components/poster/poster"
import { hostedEventPath, hostedEvents, type HostedEvent } from "@/lib/hosted-events"
import { todaysEvents } from "@/lib/screen-rotation"

// Today's event depends on the date.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Posters | Commons Hub Brussels",
  description: "Printable posters for the Commons Hub Brussels: today's event programme, membership and the fridge.",
}

interface PosterLink {
  href: string
  title: string
  description: string
  format: string
}

const ALWAYS: PosterLink[] = [
  { href: "/membership/poster", title: "Become a member", description: "Benefits, prices and a QR code to join.", format: "A4" },
  { href: "/fridge/poster", title: "The fridge", description: "Record what you take, help us keep this fridge full.", format: "A4 or A5" },
]

const eventPoster = (event: HostedEvent, today: boolean): PosterLink => ({
  href: `${hostedEventPath(event)}/poster`,
  title: event.name,
  description: today ? "Today's programme, with a QR code to the event page." : "The programme, with a QR code to the event page.",
  format: "A4",
})

/** A small sheet with the logo and the title, standing in for the poster. */
function PosterCard({ poster }: { poster: PosterLink }) {
  return (
    <li>
      <Link href={poster.href} className="group flex h-full gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/30">
        <div className="flex aspect-[210/297] w-20 shrink-0 flex-col rounded-sm bg-white p-2 text-black shadow-sm ring-1 ring-black/10">
          <PosterLogo className="h-4 w-4" />
          <span className="mt-2 line-clamp-4 text-[9px] font-bold leading-tight">{poster.title}</span>
          <span className="mt-auto space-y-0.5">
            <span className="block h-0.5 w-3/4 rounded bg-black/15" />
            <span className="block h-0.5 w-1/2 rounded bg-black/15" />
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground group-hover:underline">{poster.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{poster.description}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{poster.format}</p>
        </div>
      </Link>
    </li>
  )
}

function Section({ title, posters }: { title: string; posters: PosterLink[] }) {
  if (posters.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {posters.map((p) => (
          <PosterCard key={p.href} poster={p} />
        ))}
      </ul>
    </section>
  )
}

/** Every poster the site can print, today's event first. */
export default function PostersPage() {
  const now = Date.now()
  const today = todaysEvents(now)
  const upcoming = hostedEvents.filter((e) => e.sessions.length > 0 && Date.parse(e.endAt) > now && !today.includes(e))

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-foreground">Posters</h1>
      <p className="mt-2 text-muted-foreground">Ready to print, black on white to save ink. Open one and press Print, or save it as a PDF.</p>
      <Section title="Today" posters={today.map((e) => eventPoster(e, true))} />
      <Section title="Around the hub" posters={ALWAYS} />
      <Section title="Upcoming events" posters={upcoming.map((e) => eventPoster(e, false))} />
    </div>
  )
}
