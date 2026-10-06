"use client"

import { useEffect, useRef, useState } from "react"

import type { ScreenSlide } from "@/lib/screen-rotation"
import { SLIDE_MESSAGE, SLIDE_READY, type SlideMessage } from "./screen-live"

/** A slide older than this reloads (new data, new code) the next time it goes off screen. */
const RELOAD_AFTER_MS = 10 * 60_000

/**
 * Cycles through the big-screen pages. Each one stays loaded in its own frame
 * (they refresh their own data), so switching is instant: a cross-fade, no
 * reload, no flash. The slide on show is told how long it stays, for its
 * clock's countdown; a slide that has been loaded for more than ten minutes
 * reloads right after it fades out, so a new version of the site gets on
 * screen by itself without anyone seeing it load. A slide with several
 * designs (`variants`) switches to the next one each time it goes off
 * screen, so they take turns.
 *
 * Left / right arrow keys go to the previous / next slide (a hack for whoever
 * has a keyboard at hand; nothing on screen says so).
 */
export function ScreenRotator({ slides }: { slides: ScreenSlide[] }) {
  const [index, setIndex] = useState(0)
  const frames = useRef<Array<HTMLIFrameElement | null>>([])
  const loadedAt = useRef<number[]>([])
  const endsAt = useRef(0)
  const shown = useRef(0)
  const variant = useRef<number[]>([])

  const tell = (i: number) => {
    const message: SlideMessage =
      i === index && slides.length > 1
        ? { type: SLIDE_MESSAGE, active: true, seconds: slides[i].seconds, endsAt: endsAt.current }
        : { type: SLIDE_MESSAGE, active: false }
    frames.current[i]?.contentWindow?.postMessage(message, window.location.origin)
  }

  // A slide's clock that has just started listening asks for its timing.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== SLIDE_READY) return
      const i = frames.current.findIndex((f) => f?.contentWindow === e.source)
      if (i >= 0) tell(i)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  })

  // Arrow keys, on the rotator or inside a slide (the frames are same-origin).
  useEffect(() => {
    if (slides.length < 2) return
    const onKey = (e: KeyboardEvent) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
      if (step) setIndex((i) => (i + step + slides.length) % slides.length)
    }
    const targets: Window[] = [window]
    for (const f of frames.current) {
      try {
        if (f?.contentWindow) targets.push(f.contentWindow)
      } catch {}
    }
    targets.forEach((t) => t.addEventListener("keydown", onKey))
    return () => targets.forEach((t) => t.removeEventListener("keydown", onKey))
  }, [index, slides.length])

  useEffect(() => {
    if (slides.length < 2) return
    endsAt.current = Date.now() + slides[index].seconds * 1000
    slides.forEach((_, i) => tell(i))
    // The slide that just went off screen: reload it once it has faded out, if it is getting old.
    const previous = shown.current
    shown.current = index
    const reload = setTimeout(() => {
      if (previous === index) return
      const variants = slides[previous].variants
      const frame = frames.current[previous]
      if (variants && variants.length > 1 && frame) {
        variant.current[previous] = ((variant.current[previous] ?? 0) + 1) % variants.length
        frame.src = variants[variant.current[previous]]
      } else if (Date.now() - (loadedAt.current[previous] ?? 0) > RELOAD_AFTER_MS) frame?.contentWindow?.location.reload()
    }, 2000)
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), slides[index].seconds * 1000)
    return () => {
      clearTimeout(timer)
      clearTimeout(reload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#111]">
      <style>{"html, body { overflow: hidden; background: #111; }"}</style>
      {slides.map((slide, i) => (
        <iframe
          key={slide.path}
          ref={(el) => {
            frames.current[i] = el
          }}
          onLoad={() => {
            loadedAt.current[i] = Date.now()
            tell(i)
          }}
          src={slide.path}
          title={slide.path}
          aria-hidden={i !== index}
          tabIndex={-1}
          className="absolute inset-0 h-full w-full border-0 transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
        />
      ))}
    </div>
  )
}
