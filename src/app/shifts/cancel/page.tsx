import type { Metadata } from "next"
import Link from "next/link"

import { cancel as cancelShift, isShiftsConfigured, ShiftError } from "@/lib/shifts-service"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Cancel a shift | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * The link in the shift DM ("Not you, or can't make it?"). Opening it does
 * nothing by itself (Discord and mail apps open links to preview them); the
 * shift is only cancelled when the button is pressed.
 */
export default async function CancelShiftPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams

  async function cancel(formData: FormData) {
    "use server"
    const token = String(formData.get("t") ?? "")
    const { redirect } = await import("next/navigation")
    try {
      const res = await cancelShift(token)
      const params = new URLSearchParams({ start: res.shift.start, end: res.shift.end, ...(res.alreadyCancelled ? { already: "1" } : {}) })
      redirect(`/shifts/cancel/done?${params}`)
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error // the redirect itself
      const message = error instanceof ShiftError && error.status < 500 ? error.message : "Could not cancel the shift, please try again or use /shifts on Discord"
      redirect(`/shifts/cancel/done?${new URLSearchParams({ error: message })}`)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <h1 className="text-3xl font-bold text-foreground">Cancel a shift</h1>
      {!t || !isShiftsConfigured() ? (
        <p className="mt-4 text-muted-foreground">This link is not valid. You can manage your shifts with /shifts on our Discord.</p>
      ) : (
        <form action={cancel} className="mt-6 space-y-4">
          <input type="hidden" name="t" value={t} />
          <p className="text-muted-foreground">Someone signed you up for a shift from the community tablet, or you can no longer make it? Cancel it here. The others on the shift will see it.</p>
          <button type="submit" className="h-11 rounded-lg bg-primary px-5 font-semibold text-primary-foreground">
            Cancel this shift
          </button>
          <p className="text-sm text-muted-foreground">
            Changed your mind? Just close this page. <Link href="/tablet" className="underline">See the upcoming shifts</Link>.
          </p>
        </form>
      )}
    </div>
  )
}
