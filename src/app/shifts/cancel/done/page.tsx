import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Shift cancelled | Commons Hub Brussels",
  robots: { index: false },
}

const TZ = "Europe/Brussels"
function when(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return ""
  const day = s.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })
  const t = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
  return `${day}, ${t(s)}–${t(e)}`
}

/** After the cancel button: what happened. */
export default async function ShiftCancelledPage({ searchParams }: { searchParams: Promise<{ start?: string; end?: string; already?: string; error?: string }> }) {
  const { start, end, already, error } = await searchParams
  const shift = start && end ? when(start, end) : ""
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      {error ? (
        <>
          <h1 className="text-3xl font-bold text-foreground">The shift was not cancelled</h1>
          <p className="mt-4 text-muted-foreground">{error.slice(0, 200)}</p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold text-foreground">{already ? "Already cancelled" : "Shift cancelled"}</h1>
          <p className="mt-4 text-muted-foreground">
            {shift ? `Your shift on ${shift} is cancelled.` : "Your shift is cancelled."} Thanks for letting us know, it helps the others plan.
          </p>
        </>
      )}
      <p className="mt-6">
        <Link href="/tablet" className="underline">
          See the upcoming shifts
        </Link>
      </p>
    </div>
  )
}
