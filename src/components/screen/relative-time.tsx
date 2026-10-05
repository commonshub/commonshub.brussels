"use client"

import { useNow } from "./screen-live"

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

const WEEK_MS = 7 * 86_400_000

/** "5 minutes ago", "yesterday", "3 days ago"; a week or more ago, the date ("Wed 30 Sept"). */
export function relativeTime(ms: number, now: number): string {
  if (now - ms >= WEEK_MS) return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Brussels" })
  const diff = ms - now
  const format = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" })
  for (const [unit, size] of UNITS) if (Math.abs(diff) >= size) return format.format(Math.round(diff / size), unit)
  return "just now"
}

/** A relative time that keeps itself up to date on a screen left on all day. */
export function RelativeTime({ ms }: { ms: number }) {
  const now = useNow(0, 60_000)
  return <span suppressHydrationWarning>{relativeTime(ms, now)}</span>
}
