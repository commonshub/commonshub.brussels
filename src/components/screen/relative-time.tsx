"use client"

import { useNow } from "./screen-live"

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

/** "5 minutes ago", "yesterday", "3 days ago". */
export function relativeTime(ms: number, now: number): string {
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
