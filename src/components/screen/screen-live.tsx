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

/** What /screen tells the slide on show: how long it stays (see screen-rotator.tsx). */
export const SLIDE_MESSAGE = "chb-screen:slide"
/** A clock inside /screen asks for its slide's timing once it is listening. */
export const SLIDE_READY = "chb-screen:ready"
export type SlideMessage = { type: typeof SLIDE_MESSAGE; active: boolean; seconds?: number; endsAt?: number }

/**
 * The hub's local time, small in a corner. Inside /screen it doubles as the
 * countdown to the next slide: the digits fill with orange from left to
 * right, and are all orange when the next slide comes.
 */
export function ScreenClock({ offsetMs = 0 }: { offsetMs?: number }) {
  const now = useNow(offsetMs)
  // `elapsed` is fixed when the timing arrives: recomputing it on each tick would make the fill jump.
  const [slide, setSlide] = useState<{ seconds: number; endsAt: number; elapsed: number } | null>(null)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== SLIDE_MESSAGE) return
      const m = e.data as SlideMessage
      setSlide(
        m.active && m.seconds && m.endsAt
          ? { seconds: m.seconds, endsAt: m.endsAt, elapsed: Math.min(m.seconds, Math.max(0, m.seconds - (m.endsAt - Date.now()) / 1000)) }
          : null,
      )
    }
    window.addEventListener("message", onMessage)
    if (window.parent !== window) window.parent.postMessage({ type: SLIDE_READY }, window.location.origin)
    return () => window.removeEventListener("message", onMessage)
  }, [])
  return (
    <span
      key={slide?.endsAt ?? "idle"}
      className="tabular-nums"
      suppressHydrationWarning
      style={
        slide
          ? {
              backgroundImage: "linear-gradient(90deg, #FF4C02 48%, currentColor 52%)",
              backgroundSize: "210% 100%",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: `screen-clock-fill ${slide.seconds}s linear ${-slide.elapsed}s forwards`,
            }
          : undefined
      }
    >
      {slide && <style>{"@keyframes screen-clock-fill { from { background-position: 100% 0; } to { background-position: 0% 0; } }"}</style>}
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
