"use client"

import { useEffect, useRef, useState } from "react"

import type { ScreenSlide } from "@/lib/screen-rotation"
import { SLIDE_MESSAGE, SLIDE_READY, type SlideMessage } from "./screen-live"

/** The cross-fade between two slides. */
const FADE_MS = 1200
/** How long before its turn the next slide starts loading (in the background). */
const PRELOAD_MS = 10_000

interface Mounted {
  /** A new key loads the slide afresh. */
  key: string
  src: string
  /** Load order: frames render in it, so a frame already in the page never moves (moving one reloads it). */
  seq: number
}

/**
 * Cycles through the big-screen pages, each in its own frame. Only two are
 * loaded at a time: the slide on show, and either the one that just faded
 * out or the next one. Ten seconds before a slide's turn ends, in one go,
 * the previous slide is unloaded and the next one starts loading in the
 * background, so the switch is still a cross-fade with no flash, and the
 * page changes once per slide. A TV browser (Samsung Tizen) has little
 * memory: with every slide kept loaded and animating it reloaded the page
 * every few seconds.
 *
 * Each slide therefore loads afresh every time it comes up: new data, new
 * code after a deploy. A slide with several designs (`variants`) shows the
 * next one each time, so they take turns. The slide on show is told how long
 * it stays, for its clock's countdown.
 *
 * Left / right arrow keys go to the previous / next slide (a hack for whoever
 * has a keyboard at hand; nothing on screen says so).
 */
export function ScreenRotator({ slides }: { slides: ScreenSlide[] }) {
  const [index, setIndex] = useState(0)
  const frames = useRef<Array<HTMLIFrameElement | null>>([])
  const endsAt = useRef(0)
  const visits = useRef<number[]>([])
  const seq = useRef(0)

  /** The slide's address for its n-th showing: the next design, when it has several. */
  const mount = (i: number): Mounted => {
    const n = visits.current[i] ?? 0
    visits.current[i] = n + 1
    const variants = slides[i].variants
    return {
      key: `${i}-${n}`,
      src: variants && variants.length > 0 ? variants[n % variants.length] : slides[i].path,
      seq: seq.current++,
    }
  }

  const mountedRef = useRef<Map<number, Mounted> | null>(null)
  if (!mountedRef.current) {
    mountedRef.current = new Map()
    if (slides.length > 0) mountedRef.current.set(0, mount(0))
    if (slides.length > 1) mountedRef.current.set(1, mount(1))
  }
  const [mounted, setMountedState] = useState(mountedRef.current)
  const setMounted = (next: Map<number, Mounted>) => {
    mountedRef.current = next
    setMountedState(next)
  }

  const tell = (i: number) => {
    const message: SlideMessage =
      i === index && slides.length > 1
        ? {
            type: SLIDE_MESSAGE,
            active: true,
            seconds: slides[i].seconds,
            endsAt: endsAt.current,
          }
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
  }, [index, slides.length, mounted])

  useEffect(() => {
    if (slides.length < 2) return
    endsAt.current = Date.now() + slides[index].seconds * 1000
    const next = (index + 1) % slides.length
    // The slide on show must be loaded (it isn't when arrow keys jump ahead); the previous one keeps fading out.
    const current = mountedRef.current!
    if (!current.has(index)) {
      const out = new Map(current)
      out.set(index, mount(index))
      setMounted(out)
    }
    // Then, once, well before the switch: unload the previous slide and start loading the next.
    const unload = setTimeout(
      () => {
        const out = new Map<number, Mounted>()
        const now = mountedRef.current!
        out.set(index, now.get(index)!)
        out.set(next, now.get(next) ?? mount(next))
        setMounted(out)
      },
      Math.max(FADE_MS, slides[index].seconds * 1000 - PRELOAD_MS),
    )
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), slides[index].seconds * 1000)
    return () => {
      clearTimeout(timer)
      clearTimeout(unload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slides])

  // Tell every loaded slide whether it is on (and until when) whenever that changes.
  useEffect(() => {
    mounted.forEach((_, i) => tell(i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, mounted])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#111]">
      <style>{"html, body { overflow: hidden; background: #111; }"}</style>
      {[...mounted.entries()]
        .sort(([, a], [, b]) => a.seq - b.seq)
        .map(([i, m]) => (
          <iframe
            key={m.key}
            ref={(el) => {
              frames.current[i] = el
            }}
            onLoad={() => tell(i)}
            src={m.src}
            title={slides[i].path}
            aria-hidden={i !== index}
            tabIndex={-1}
            className="absolute inset-0 h-full w-full border-0 transition-opacity duration-1000"
            style={{
              opacity: i === index ? 1 : 0,
              pointerEvents: i === index ? "auto" : "none",
            }}
          />
        ))}
    </div>
  )
}
