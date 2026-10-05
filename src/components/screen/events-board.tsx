"use client"

import { dayLabel, timeRange, type ScreenEvent } from "@/lib/events-screen-format"
import { useNow } from "./screen-live"
import { ACCENT, MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /events/screen: the next events as cards (cover, day, time, title), four
 * across. Client-side so "Today", "Tomorrow" and "Now" follow the clock
 * between refreshes; an event that is over drops off by itself.
 */
export function EventsBoard({ events, qrSvg, url }: { events: ScreenEvent[]; qrSvg: string; url: string }) {
  const now = useNow(0, 30_000)
  const shown = events.filter((e) => e.endMs > now)
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: s(1.6) }}>
      {shown.length > 0 ? (
        <div className="grid min-h-0 flex-1 grid-cols-4" style={{ gap: s(1.6), gridTemplateRows: `repeat(${Math.ceil(shown.length / 4)}, minmax(0, 1fr))`, maxHeight: shown.length <= 4 ? "60%" : undefined }}>
          {shown.map((e) => {
            const live = e.startMs <= now
            return (
              <article key={e.id} className="flex min-h-0 min-w-0 flex-col overflow-hidden" style={{ borderRadius: s(0.8), background: "#1c1c1c" }}>
                {/* The cover takes what the text leaves. */}
                <div className="relative min-h-0 flex-1" style={{ background: "#262626" }}>
                  {e.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.cover} alt="" className="h-full w-full object-cover" />
                  )}
                  {live && (
                    <span className="absolute" style={{ left: s(0.8), top: s(0.8), padding: `${s(0.2)} ${s(0.7)}`, borderRadius: s(0.4), background: ACCENT, fontSize: s(1.1), fontWeight: 700 }}>
                      Now
                    </span>
                  )}
                </div>
                <div className="shrink-0" style={{ padding: `${s(0.9)} ${s(1)} ${s(1.1)}` }}>
                  <div className="tabular-nums" style={{ fontSize: s(1.25), fontWeight: 600, color: live || dayLabel(e.startMs, now) === "Today" ? ACCENT : MUTED }}>
                    {dayLabel(e.startMs, now)} · {timeRange(e.startMs, e.endMs)}
                  </div>
                  <h2 className="line-clamp-2" style={{ marginTop: s(0.3), fontSize: s(1.5), fontWeight: 700, lineHeight: 1.2, minHeight: "2.4em" }}>
                    {e.name}
                  </h2>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center" style={{ fontSize: s(2.6), color: MUTED }}>
          No upcoming events yet.
        </div>
      )}
      <div className="flex shrink-0 items-end justify-between" style={{ gap: s(2) }}>
        <p style={{ fontSize: s(1.3), color: MUTED, maxWidth: s(60) }}>Everyone is welcome. Register on our website, or host your own event at the Commons Hub.</p>
        <ScreenQr qrSvg={qrSvg} cta="All our events" url={url} />
      </div>
    </div>
  )
}
