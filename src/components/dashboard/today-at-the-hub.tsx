import Link from "next/link"
import { CalendarDays, Users } from "lucide-react"

import { loadPublicEventsForDay } from "@/lib/day-data"
import { type DoorVisitor, loadDoorVisitors } from "@/lib/door-today"
import { getProxiedImageUrl } from "@/lib/image-proxy"

const TZ = "Europe/Brussels"
const hm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })

/**
 * The top of the member dashboard: who the door let in today (members only: the dashboard is),
 * and today's public events at the hub. Refreshed when the member opens the door from the page.
 */
export async function TodayAtTheHub({ me, now = new Date() }: { me: { username: string; avatar: string | null }; now?: Date }) {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ })
  const [visitors, events] = await Promise.all([
    loadDoorVisitors(me, now).catch(() => [] as DoorVisitor[]),
    Promise.resolve()
      .then(() => loadPublicEventsForDay(today))
      .catch(() => []),
  ])
  const upcoming = events.filter((e) => Date.parse(e.endAt || e.startAt) > now.getTime()).sort((a, b) => a.startAt.localeCompare(b.startAt))
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5" aria-labelledby="today-at-the-hub">
      <h2 id="today-at-the-hub" className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Users className="h-5 w-5 text-primary" /> Today at the hub
      </h2>
      {visitors.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nobody has come in yet today.</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
          {visitors.map((v) => (
            <li key={`${v.name}-${v.arrivedAt}`} className="flex w-16 flex-col items-center text-center">
              {v.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getProxiedImageUrl(v.avatar)} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">{v.name.charAt(0).toUpperCase()}</span>
              )}
              <span className="mt-1 w-full truncate text-xs font-semibold text-foreground">{v.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {v.guest ? "guest · " : ""}
                {hm(v.arrivedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {upcoming.map((e) => {
            const inner = (
              <>
                <span className="text-sm text-primary">
                  <CalendarDays className="mr-1 inline h-4 w-4 align-[-3px]" />
                  {hm(Date.parse(e.startAt))}
                  {e.endAt ? `–${hm(Date.parse(e.endAt))}` : ""}
                </span>
                <span className="block font-medium text-foreground">{e.name}</span>
              </>
            )
            const cls = "block py-3 transition hover:opacity-80"
            return (
              <li key={e.id}>
                {e.url?.startsWith("/") ? (
                  <Link href={e.url} className={cls}>
                    {inner}
                  </Link>
                ) : e.url ? (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <div className="py-3">{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
