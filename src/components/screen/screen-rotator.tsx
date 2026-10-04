"use client"

import { useEffect, useState } from "react"

import type { ScreenSlide } from "@/lib/screen-rotation"

/**
 * Cycles through the big-screen pages. Each one stays loaded in its own frame
 * (they refresh their own data), so switching is instant: a cross-fade, no
 * reload, no flash.
 */
export function ScreenRotator({ slides }: { slides: ScreenSlide[] }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (slides.length < 2) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % slides.length), slides[index].seconds * 1000)
    return () => clearTimeout(timer)
  }, [index, slides])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#111]">
      <style>{"html, body { overflow: hidden; background: #111; }"}</style>
      {slides.map((slide, i) => (
        <iframe
          key={slide.path}
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
