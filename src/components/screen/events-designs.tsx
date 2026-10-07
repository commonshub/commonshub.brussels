"use client"

import type React from "react"
import { useEffect, useState } from "react"

import {
  dayKey,
  dayName,
  daysAway,
  fromNow,
  hhmm,
  occurrences,
  timeRange,
  weekdayLong,
  weekdayMon,
  weekdayShort,
  weekGroup,
  whenLong,
  type BoardData,
  type BoardEvent,
  type Recurring,
  type RecurringNext,
  type WeekGroup,
} from "@/lib/events-board-format"
import { useNow } from "./screen-live"
import { ACCENT, MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /events/screen, in three designs on the same data (lib/events-board.ts):
 * 1. an agenda: the next event (or the featured one, taking turns) up front,
 *    the rest grouped by week, the weekly events in a box of their own;
 * 2. the next two weeks as a calendar, weekly events marked ↻;
 * 3. the month ahead (five weeks from this Monday), the next or featured event on the side.
 * Client-side so "Today", "in 3 hours" follow the clock between refreshes.
 * Nothing loops forever and nothing uses filters: the TV's browser is frail.
 */

const FEATURED = "#9d7bff"
const RECUR = "#c4a46b"

/** The weekly events, as "Every Monday 13:00–14:00". */
const recurWhen = (r: Recurring, long = true) => `${long ? `Every ${weekdayLong(r.weekday)}` : weekdayShort(r.weekday)} ${r.start}${r.end ? `–${r.end}` : ""}`

function Kicker({ children, color = ACCENT }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: s(1.05), letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color }}>{children}</div>
}

function Cover({ event, emoji = "📅", whole = false }: { event: BoardEvent; emoji?: string; whole?: boolean }) {
  // Many covers are Luma's title cards: shown whole when large, so their text isn't cut.
  return event.cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={event.cover} alt="" className={`block h-full w-full ${whole ? "object-contain" : "object-cover"}`} />
  ) : (
    <div className="grid h-full w-full place-items-center" style={{ background: "linear-gradient(135deg, #2a2a30, #1a1a1e)", fontSize: s(6) }}>
      {emoji}
    </div>
  )
}

/** The next event, and the featured one if there is one, taking turns every 12 seconds. */
function Spotlight({ next, featured, now }: { next: BoardEvent | undefined; featured: BoardEvent | null; now: number }) {
  const items = [next, featured].filter((e): e is BoardEvent => !!e)
  const [turn, setTurn] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const id = setInterval(() => setTurn((t) => (t + 1) % items.length), 12_000)
    return () => clearInterval(id)
  }, [items.length])
  const e = items[turn % Math.max(1, items.length)]
  if (!e) return <p style={{ fontSize: s(1.8), color: MUTED }}>Nothing planned yet. Host your own event at the Commons Hub!</p>
  const isFeatured = !!e.featured
  return (
    <div key={e.id} className="flex min-h-0 flex-1 flex-col" style={{ animation: "ev-in 700ms ease-out both" }}>
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ borderRadius: s(1.1), background: "#1c1c1c" }}>
        <Cover event={e} emoji={isFeatured ? "⭐" : "📅"} whole />
        <span className="absolute" style={{ left: s(1), top: s(1), padding: `${s(0.35)} ${s(0.9)}`, borderRadius: 999, background: isFeatured ? FEATURED : ACCENT, fontSize: s(1.3), fontWeight: 700 }}>
          {isFeatured ? "Featured" : e.startMs <= now ? "Happening now" : daysAway(e.startMs, now) <= 1 ? dayName(e.startMs, now) : "Next up"}
        </span>
      </div>
      <div className="shrink-0" style={{ marginTop: s(1.1) }}>
        <div className="flex items-baseline" style={{ gap: s(0.9) }}>
          <b style={{ fontSize: s(2) }}>{whenLong(e, now)}</b>
          <span style={{ fontSize: s(1.45), color: MUTED }} suppressHydrationWarning>
            {fromNow(e.startMs, now)}
          </span>
        </div>
        <h2 className="line-clamp-2" style={{ marginTop: s(0.4), fontSize: s(2.7), lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.01em", minHeight: "2.2em" }}>
          {e.name}
        </h2>
        {e.tagline && <p className="line-clamp-1" style={{ marginTop: s(0.3), fontSize: s(1.5), color: MUTED }}>{e.tagline}</p>}
      </div>
    </div>
  )
}

/** The weekly events, each with its next date. */
function RecurringBox({ recurring, now }: { recurring: RecurringNext[]; now: number }) {
  if (recurring.length === 0) return null
  return (
    <div className="shrink-0" style={{ padding: `${s(0.9)} ${s(1.1)}`, borderRadius: s(0.9), background: "rgba(196,164,107,0.1)", border: `1px dashed ${RECUR}` }}>
      <Kicker color={RECUR}>↻ Every week</Kicker>
      {recurring.map((r) => (
        <div key={r.id} className="flex min-w-0 items-baseline" style={{ gap: s(0.7), marginTop: s(0.5), fontSize: s(1.35) }}>
          <span>{r.emoji}</span>
          <b className="whitespace-nowrap">{recurWhen(r, false)}</b>
          <span className="min-w-0 truncate">{r.title}</span>
          {r.note && <Note>{r.note}</Note>}
          <span className="ml-auto shrink-0 whitespace-nowrap" style={{ color: MUTED, fontSize: s(1.05) }} suppressHydrationWarning>
            next: {dayName(r.nextMs, now, false)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 whitespace-nowrap" style={{ padding: `0 ${s(0.45)}`, borderRadius: s(0.35), border: `1px solid ${RECUR}`, color: RECUR, fontSize: "0.75em", fontWeight: 600 }}>
      🔒 {children}
    </span>
  )
}

/** The page's time: the server's on the first render (so it hydrates as rendered), then the live clock. */
function useBoardNow(serverNow: number): number {
  const live = useNow(0, 30_000)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? live : serverNow
}

const GROUP_TITLE: Record<WeekGroup, string> = { "this week": "This week", "next week": "Next week", later: "Later" }

/** Design 1: the next event up front, the rest by week, the weekly ones apart. */
export function AgendaDesign({ data, qrSvg, url }: { data: BoardData; qrSvg: string; url: string }) {
  const now = useBoardNow(data.now)
  const events = data.events.filter((e) => e.endMs > now)
  const [next, ...rest] = events
  const groups = new Map<WeekGroup, BoardEvent[]>()
  for (const e of rest.slice(0, 5)) {
    const g = weekGroup(e.startMs, now)
    groups.set(g, [...(groups.get(g) ?? []), e])
  }
  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "53% 1fr", gap: s(3) }}>
      <style>{"@keyframes ev-in { from { opacity: 0 } to { opacity: 1 } }"}</style>
      <section className="flex min-h-0 min-w-0 flex-col">
        <Spotlight next={next} featured={data.featured} now={now} />
      </section>
      <section className="flex min-h-0 min-w-0 flex-col" style={{ gap: s(1.2) }}>
        <div className="min-h-0 flex-1 overflow-hidden">
          {[...groups.entries()].map(([g, list]) => (
            <div key={g} style={{ marginBottom: s(1) }}>
              <div style={{ fontSize: s(1), letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>{GROUP_TITLE[g]}</div>
              {list.map((e) => (
                <div key={e.id} className="flex items-baseline" style={{ gap: s(1), padding: `${s(0.5)} 0`, borderTop: "1px solid rgba(255,255,255,0.1)", opacity: g === "later" ? 0.6 : 1 }}>
                  <div className="shrink-0" style={{ width: s(5.6) }}>
                    <div style={{ fontSize: s(1.3), fontWeight: 700 }}>{dayName(e.startMs, now, false)}</div>
                    <div style={{ fontSize: s(0.95), color: MUTED }} suppressHydrationWarning>
                      {fromNow(e.startMs, now)}
                    </div>
                  </div>
                  <div className="shrink-0 tabular-nums" style={{ width: s(4), fontSize: s(1.25), color: MUTED }}>
                    {hhmm(e.startMs)}
                  </div>
                  <div className="line-clamp-2 min-w-0" style={{ fontSize: s(1.4), lineHeight: 1.2 }}>
                    {e.name}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <RecurringBox recurring={data.recurring} now={now} />
        <div className="flex shrink-0 justify-end">
          <ScreenQr qrSvg={qrSvg} cta="All our events" url={url} />
        </div>
      </section>
    </div>
  )
}

function RecurChip({ r }: { r: Recurring }) {
  return (
    <div className="truncate" style={{ marginTop: s(0.35), padding: `${s(0.2)} ${s(0.5)}`, borderRadius: s(0.45), border: `1px dashed ${RECUR}`, color: "#e2c891", fontSize: s(0.95) }}>
      ↻ {r.start} {r.emoji} {r.title}
      {r.note ? " 🔒" : ""}
    </div>
  )
}

/** Design 2: this week and next, Monday to Sunday. */
export function WeeksDesign({ data, qrSvg, url }: { data: BoardData; qrSvg: string; url: string }) {
  const now = useBoardNow(data.now)
  const today = dayKey(now)
  const monday = new Date(Date.parse(`${today}T12:00:00Z`) - weekdayMon(now) * 86_400_000).toISOString().slice(0, 10)
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(`${monday}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10))
  const byDay = new Map<string, BoardEvent[]>()
  for (const e of data.events) if (e.endMs > now) byDay.set(dayKey(e.startMs), [...(byDay.get(dayKey(e.startMs)) ?? []), e])
  const recurByDay = new Map<string, Recurring[]>()
  for (const r of data.recurring) for (const d of occurrences(r, monday, 14)) recurByDay.set(d, [...(recurByDay.get(d) ?? []), r])
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: s(0.8) }}>
      <div className="grid shrink-0 grid-cols-7" style={{ gap: s(0.5) }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} style={{ fontSize: s(1), letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gap: s(0.5), gridTemplateRows: "1fr 1fr" }}>
        {days.map((d) => {
          const past = d < today
          const isToday = d === today
          const n = daysAway(Date.parse(`${d}T12:00:00Z`), now)
          return (
            <div
              key={d}
              className="min-h-0 overflow-hidden"
              style={{
                borderRadius: s(0.8),
                padding: s(0.7),
                background: isToday ? "rgba(255,76,2,0.09)" : "rgba(255,255,255,0.045)",
                boxShadow: isToday ? `inset 0 0 0 ${s(0.15)} ${ACCENT}` : undefined,
                opacity: past ? 0.3 : 1,
              }}
            >
              <div style={{ fontSize: s(1.5), fontWeight: 700 }}>
                {Number(d.slice(8))}
                {(isToday || n === 1) && <span style={{ marginLeft: s(0.5), fontSize: s(0.95), color: isToday ? ACCENT : MUTED, fontWeight: 600 }}>{isToday ? "today" : "tomorrow"}</span>}
              </div>
              {(recurByDay.get(d) ?? []).map((r) => (
                <RecurChip key={r.id} r={r} />
              ))}
              {(byDay.get(d) ?? []).map((e) => (
                <div key={e.id} style={{ marginTop: s(0.4), padding: `${s(0.35)} ${s(0.55)}`, borderRadius: s(0.55), background: "rgba(255,255,255,0.08)", borderLeft: `${s(0.25)} solid ${ACCENT}` }}>
                  <div className="tabular-nums" style={{ fontSize: s(0.95), color: MUTED }}>
                    {timeRange(e.startMs, e.endMs)}
                  </div>
                  <div className="line-clamp-3" style={{ fontSize: s(1.15), lineHeight: 1.2, fontWeight: 600 }}>
                    {e.name}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <div className="flex shrink-0 items-end justify-between" style={{ gap: s(2) }}>
        <div style={{ fontSize: s(1.15), color: MUTED, lineHeight: 1.5 }}>
          <div>
            <span style={{ color: RECUR }}>↻ every week</span> ·{" "}
            {data.recurring.map((r, i) => (
              <span key={r.id}>
                {i > 0 && " · "}
                {r.emoji} {weekdayShort(r.weekday)} {r.start} {r.title}
                {r.note ? ` (${r.note})` : ""}
              </span>
            ))}
          </div>
          {data.featured && (
            <div style={{ color: "#fff" }}>
              <span style={{ color: FEATURED, fontWeight: 700 }}>★ Featured</span> {data.featured.name} · {whenLong(data.featured, now)} ·{" "}
              <span suppressHydrationWarning>{fromNow(data.featured.startMs, now)}</span>
            </div>
          )}
        </div>
        <ScreenQr qrSvg={qrSvg} cta="All our events" url={url} />
      </div>
    </div>
  )
}

/** Design 3: the month ahead, five weeks from this Monday, and the next event (or the featured one) on the side. */
export function MonthDesign({ data, qrSvg, url }: { data: BoardData; qrSvg: string; url: string }) {
  const now = useBoardNow(data.now)
  const today = dayKey(now)
  const monday = new Date(Date.parse(`${today}T12:00:00Z`) - weekdayMon(now) * 86_400_000).toISOString().slice(0, 10)
  const days = Array.from({ length: 35 }, (_, i) => new Date(Date.parse(`${monday}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10))
  const events = data.events.filter((e) => e.endMs > now)
  const byDay = new Map<string, BoardEvent[]>()
  for (const e of events) byDay.set(dayKey(e.startMs), [...(byDay.get(dayKey(e.startMs)) ?? []), e])
  const recurByDay = new Map<string, Recurring[]>()
  for (const r of data.recurring) for (const d of occurrences(r, monday, 35)) recurByDay.set(d, [...(recurByDay.get(d) ?? []), r])
  const monthOf = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
  const next = events[0]
  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 30%", gap: s(2.4) }}>
      <style>{"@keyframes ev-in { from { opacity: 0 } to { opacity: 1 } }"}</style>
      <section className="flex min-h-0 min-w-0 flex-col" style={{ gap: s(0.5) }}>
        <div className="grid shrink-0 grid-cols-7" style={{ gap: s(0.4) }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} style={{ fontSize: s(0.95), letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gap: s(0.4), gridTemplateRows: "repeat(5, minmax(0, 1fr))" }}>
          {days.map((d) => {
            const past = d < today
            const isToday = d === today
            const list = byDay.get(d) ?? []
            const recur = recurByDay.get(d) ?? []
            const first = d.endsWith("-01")
            return (
              <div
                key={d}
                className="min-h-0 min-w-0 overflow-hidden"
                style={{
                  borderRadius: s(0.6),
                  padding: `${s(0.4)} ${s(0.55)}`,
                  background: isToday ? "rgba(255,76,2,0.09)" : "rgba(255,255,255,0.045)",
                  boxShadow: isToday ? `inset 0 0 0 ${s(0.15)} ${ACCENT}` : undefined,
                  opacity: past ? 0.3 : 1,
                }}
              >
                <div className="flex items-baseline justify-between" style={{ gap: s(0.3) }}>
                  <span style={{ fontSize: s(1.25), fontWeight: 700, color: first ? ACCENT : "#fff" }}>
                    {Number(d.slice(8))}
                    {first && <span style={{ fontSize: s(0.85), marginLeft: s(0.3) }}>{monthOf(d)}</span>}
                  </span>
                  {recur.length > 0 && (
                    <span className="whitespace-nowrap" style={{ fontSize: s(0.85), color: RECUR }}>
                      ↻ {recur.map((r) => r.emoji).join("")}
                    </span>
                  )}
                </div>
                {list.slice(0, 2).map((e) => (
                  <div key={e.id} className="truncate" style={{ marginTop: s(0.25), paddingLeft: s(0.35), borderLeft: `${s(0.18)} solid ${ACCENT}`, fontSize: s(0.95), lineHeight: 1.25 }}>
                    <span style={{ color: MUTED }}>{hhmm(e.startMs)}</span> {e.name}
                  </div>
                ))}
                {list.length > 2 && <div style={{ fontSize: s(0.85), color: MUTED }}>+{list.length - 2} more</div>}
              </div>
            )
          })}
        </div>
      </section>
      <section className="flex min-h-0 min-w-0 flex-col" style={{ gap: s(1.2) }}>
        <Spotlight next={next} featured={data.featured} now={now} />
        <div className="shrink-0" style={{ fontSize: s(1.1), lineHeight: 1.5 }}>
          <div style={{ color: RECUR, fontWeight: 700, fontSize: s(0.95), letterSpacing: "0.12em", textTransform: "uppercase" }}>↻ Every week</div>
          {data.recurring.map((r) => (
            <div key={r.id} className="flex min-w-0 items-baseline" style={{ gap: s(0.5) }}>
              <span>{r.emoji}</span>
              <b className="whitespace-nowrap">{recurWhen(r, false)}</b>
              <span className="min-w-0 truncate">{r.title}</span>
              {r.note && <Note>{r.note}</Note>}
            </div>
          ))}
        </div>
        <div className="flex shrink-0 justify-end">
          <ScreenQr qrSvg={qrSvg} cta="All our events" url={url} />
        </div>
      </section>
    </div>
  )
}
