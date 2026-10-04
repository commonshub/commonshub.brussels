"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { brusselsTime } from "@/lib/screen"

/**
 * The time now, ticking. `offsetMs` shifts it, for previewing a screen at
 * another time of day (?at=… on the programme screen).
 */
export function useNow(offsetMs = 0, everyMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs)
  useEffect(() => {
    setNow(Date.now() + offsetMs)
    const id = setInterval(() => setNow(Date.now() + offsetMs), everyMs)
    return () => clearInterval(id)
  }, [offsetMs, everyMs])
  return now
}

/** The hub's local time, small in a corner. */
export function ScreenClock({ offsetMs = 0 }: { offsetMs?: number }) {
  const now = useNow(offsetMs)
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {brusselsTime(now)}
    </span>
  )
}

/**
 * Re-renders the page from the server every few minutes, so a screen left on
 * all day shows fresh data. A failed refresh keeps what is on screen.
 */
export function ScreenRefresh({ minutes = 5 }: { minutes?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), minutes * 60_000)
    return () => clearInterval(id)
  }, [router, minutes])
  return null
}
