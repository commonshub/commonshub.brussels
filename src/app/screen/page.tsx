import type { Metadata } from "next"

import { ScreenRotator } from "@/components/screen/screen-rotator"
import { ScreenBeacon } from "@/components/screen/screen"
import { ScreenRefresh, ScreenReport } from "@/components/screen/screen-live"
import { screenSlides } from "@/lib/screen-rotation"

// Today's events depend on the date: decide at request time.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Screen | Commons Hub Brussels",
  description: "What the big screen at the Commons Hub shows: today's event programme, our community, and how to contribute.",
  robots: { index: false },
}

/**
 * The hub's big screen: rotates between today's event programme (if any),
 * /members/screen and /contribute/screen. ?every=30 sets the seconds per
 * screen (an event's programme stays twice as long). Re-checks today's
 * events every 10 minutes, and each slide reloads itself when it gets old
 * (see screen-rotator.tsx).
 */
export default async function ScreenPage({ searchParams }: { searchParams: Promise<{ every?: string }> }) {
  const { every } = await searchParams
  const seconds = Math.min(600, Math.max(5, Number(every) || 30))
  return (
    <>
      <ScreenBeacon />
      <ScreenRefresh minutes={10} />
      <ScreenReport />
      <ScreenRotator slides={screenSlides(Date.now(), seconds)} />
    </>
  )
}
