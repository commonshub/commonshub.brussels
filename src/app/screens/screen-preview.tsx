"use client"

import { useEffect, useRef, useState } from "react"

/**
 * A live screen, shrunk to fit its card: the page in a frame at its real
 * size (1920×1080, or portrait for the tablet), scaled down. Loaded only
 * when scrolled to, and not clickable itself: the card links to it.
 */
export function ScreenPreview({ src, width = 1920, height = 1080 }: { src: string; width?: number; height?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setScale(el.clientWidth / width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg bg-[#111]" style={{ aspectRatio: `${width} / ${height}` }}>
      {scale > 0 && (
        <iframe
          src={src}
          title={src}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
          style={{ width, height, transform: `scale(${scale})` }}
        />
      )}
    </div>
  )
}
