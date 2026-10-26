import Link from "next/link"
import { CalendarCheck, HeartHandshake } from "lucide-react"

import { isUser, nextShiftOf } from "@/lib/next-shift"
import { isShiftsConfigured, listShifts, type Shift } from "@/lib/shifts-service"
import { WEEKS_AHEAD, weekRange } from "@/lib/tablet"

/**
 * The dashboard's shift card: the member's next shift when they have one
 * (opening /shifts on its week), otherwise an invitation to sign up.
 * Without the shifts calendar it is just the invitation.
 */

const TZ = "Europe/Brussels"
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })

async function loadNextShift(user: { discordId: string; username: string }, now = Date.now()): Promise<Shift | null> {
  if (!isShiftsConfigured()) return null
  const to = weekRange(now, WEEKS_AHEAD).toMs
  return nextShiftOf(await listShifts(new Date(now - 86_400_000), new Date(to)), user, now)
}

/** The ?week= of /shifts that shows this moment. */
function weekOf(ms: number, now: number): number {
  for (let w = 0; w <= WEEKS_AHEAD; w++) if (ms < weekRange(now, w).toMs) return w
  return 0
}

export async function NextShiftCard({ user }: { user: { discordId: string; username: string } }) {
  const now = Date.now()
  const shift = await loadNextShift(user, now).catch((error) => {
    console.error("[dashboard] next shift:", error)
    return null
  })
  if (!shift) return <SignUpForShift />
  const week = weekOf(Date.parse(shift.start), now)
  const others = shift.signups.filter((p) => !isUser(p, user))
  return (
    <Link href={week ? `/shifts?week=${week}` : "/shifts"} className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-primary bg-primary/5 p-5 transition hover:bg-primary/10">
      <CalendarCheck className="h-8 w-8 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold uppercase tracking-wide text-primary">Your next shift</span>
        <span className="block text-lg font-bold text-foreground">{day(shift.start)}, <span className="whitespace-nowrap">{hm(shift.start)}–{hm(shift.end)}</span></span>
        <span className="block text-sm text-muted-foreground">
          {others.length ? `With ${others.map((p) => p.displayName).join(", ")} · ` : ""}See the week or sign up for another
        </span>
      </span>
    </Link>
  )
}

export function SignUpForShift() {
  return (
    <Link href="/shifts" className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-dashed border-primary p-5 transition hover:bg-primary/5">
      <HeartHandshake className="h-8 w-8 shrink-0 text-primary" />
      <span>
        <span className="block text-lg font-bold text-foreground">Sign up for a shift</span>
        <span className="block text-sm text-muted-foreground">Welcome people at the hub when it’s open. Shifts earn tokens.</span>
      </span>
    </Link>
  )
}
