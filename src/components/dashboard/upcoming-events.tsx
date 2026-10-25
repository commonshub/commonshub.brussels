"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface DashboardEvent {
  id: string
  name: string
  start_at: string
  url: string
  isExternal: boolean
  externalUrl?: string
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })

/** The next few events at the hub, from the same list as the homepage. */
export function UpcomingEvents({ count = 5 }: { count?: number }) {
  const [events, setEvents] = useState<DashboardEvent[] | null>(null)
  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents((d.events ?? []).slice(0, count)))
      .catch(() => setEvents([]))
  }, [count])

  if (events === null) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />
  if (!events.length) return <p className="text-sm text-muted-foreground">Nothing planned yet.</p>
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {events.map((e) => {
        const href = (e.isExternal ? e.externalUrl : e.url) || e.url
        const own = href.startsWith("/")
        const inner = (
          <>
            <span className="w-32 shrink-0 text-sm text-primary">{when(e.start_at)}</span>
            <span className="min-w-0 truncate font-medium text-foreground">{e.name}</span>
          </>
        )
        const className = "flex flex-col gap-0.5 px-4 py-3 transition hover:bg-muted sm:flex-row sm:items-center sm:gap-4"
        return (
          <li key={e.id}>
            {own ? (
              <Link href={href} className={className}>
                {inner}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {inner}
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
