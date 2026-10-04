"use client"

import { useLayoutEffect, useRef } from "react"
import type React from "react"

/**
 * A box whose content shrinks until it fits: it sets `--fit` (1 at most) on
 * itself, and children size their text with `calc(... * var(--fit))`. Used
 * for the name cloud on /contribute/screen, so no name is ever cut off,
 * however many there are and whatever the screen.
 */
export function FitBox({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const overflows = () => {
      const box = el.getBoundingClientRect()
      return [...el.children].some((c) => {
        const r = c.getBoundingClientRect()
        return r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5 || r.left < box.left - 0.5 || r.right > box.right + 0.5
      })
    }
    const fit = () => {
      let k = 1
      el.style.setProperty("--fit", "1")
      while (k > 0.3 && overflows()) {
        k -= 0.03
        el.style.setProperty("--fit", k.toFixed(2))
      }
    }
    fit()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
