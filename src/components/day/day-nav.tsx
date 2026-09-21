"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

const dayHref = (day: string) => `/${day.replace(/-/g, "/")}`

/**
 * Previous / next day. On a phone, a horizontal swipe anywhere on the page
 * does the same: left for the next day, right for the previous one.
 */
export function DayNav({ previous, next, children }: { previous: string; next: string; children: React.ReactNode }) {
  const router = useRouter()
  const touch = useRef<{ x: number; y: number; at: number } | null>(null)

  useEffect(() => {
    router.prefetch(dayHref(previous))
    router.prefetch(dayHref(next))
  }, [router, previous, next])

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touch.current = { x: t.clientX, y: t.clientY, at: Date.now() }
    }
    const onEnd = (e: TouchEvent) => {
      const start = touch.current
      touch.current = null
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      // A deliberate horizontal swipe: wide, mostly horizontal, quick.
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - start.at > 800) return
      router.push(dayHref(dx < 0 ? next : previous))
    }
    document.addEventListener("touchstart", onStart, { passive: true })
    document.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      document.removeEventListener("touchstart", onStart)
      document.removeEventListener("touchend", onEnd)
    }
  }, [router, previous, next])

  return (
    <div className="flex items-center gap-3">
      <Link
        href={dayHref(previous)}
        aria-label="Previous day"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">{children}</div>
      <Link
        href={dayHref(next)}
        aria-label="Next day"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-5 w-5" />
      </Link>
    </div>
  )
}
