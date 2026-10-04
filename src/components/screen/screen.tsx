import type React from "react"

import { PosterLogo } from "@/components/poster/poster"
import { ScreenClock, ScreenRefresh } from "./screen-live"

/**
 * Shared frame for the pages on the hub's big screen (/…/screen): one 16:9
 * screen, light on dark (a TV glares less that way), the colour logo, the
 * time in a corner. Sizes are in a unit that is 1% of the width of a 16:9
 * screen — `s(2)` is 38px at 1920×1080 and 77px at 3840×2160 — and shrinks
 * with the height on a wider window, so nothing ever needs to scroll.
 */

/** `s(2)` = 2 screen units. */
export const s = (n: number) => `calc(var(--s) * ${n})`

export const ACCENT = "#FF4C02"
export const MUTED = "rgba(255, 255, 255, 0.68)"

export function ScreenShell({
  title,
  subtitle,
  clockOffsetMs,
  refreshMinutes = 5,
  children,
}: {
  title: string
  subtitle?: string
  clockOffsetMs?: number
  refreshMinutes?: number
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#111] text-white"
      style={{ ["--s" as string]: "min(1vw, calc(100vh / 56.25))", padding: `${s(2)} ${s(2.6)}`, gap: s(1.6) } as React.CSSProperties}
    >
      <style>{"html, body { overflow: hidden; background: #111; }"}</style>
      <ScreenRefresh minutes={refreshMinutes} />
      <header className="flex shrink-0 items-center" style={{ gap: s(1.6) }}>
        <span className="shrink-0" style={{ width: s(4.6), height: s(4.6) }}>
          <PosterLogo className="block h-full w-full" />
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ fontSize: s(1.3), color: MUTED, fontWeight: 600, lineHeight: 1.1 }}>Commons Hub Brussels</div>
          <h1 className="truncate" style={{ fontSize: s(2.8), fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {title}
            {subtitle && <span style={{ color: MUTED, fontWeight: 500 }}> · {subtitle}</span>}
          </h1>
        </div>
        <div style={{ fontSize: s(2.6), fontWeight: 600, color: MUTED }}>
          <ScreenClock offsetMs={clockOffsetMs} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
