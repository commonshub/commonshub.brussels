import type { Metadata } from "next"

import { ScreenRotator } from "@/components/screen/screen-rotator"
import { ScreenRefresh } from "@/components/screen/screen-live"
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
 * screen (an event's programme stays twice as long). Reloads every 30
 * minutes so a new day's event comes in by itself.
 */
export default async function ScreenPage({ searchParams }: { searchParams: Promise<{ every?: string }> }) {
  const { every } = await searchParams
  const seconds = Math.min(600, Math.max(5, Number(every) || 30))
  return (
    <>
      <ScreenRefresh minutes={30} />
      <ScreenRotator slides={screenSlides(Date.now(), seconds)} />
    </>
  )
}
