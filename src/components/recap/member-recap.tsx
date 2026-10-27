import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight, DoorOpen, HeartHandshake } from "lucide-react"

import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { isMember } from "@/lib/admin-check"
import { getProxiedImageUrl } from "@/lib/image-proxy"
import { loadRecap, monthName, shortDate, tokens, type TokenLine } from "@/lib/monthly-recap"

/**
 * /<username>/<year>/<month>: a member's month at the hub, the online
 * version of the monthly email (lib/monthly-recap-email.ts). Members only:
 * it says on which days someone came.
 */

const eventWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })

function shift(year: string, month: string, by: number): { year: string; month: string } {
  const d = new Date(Date.UTC(Number(year), Number(month) - 1 + by, 1))
  return { year: String(d.getUTCFullYear()), month: String(d.getUTCMonth() + 1).padStart(2, "0") }
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-4 text-center">
      <div className="text-3xl font-extrabold text-primary">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

function Lines({ title, lines }: { title: string; lines: TokenLine[] }) {
  if (!lines.length) return null
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-bold text-foreground">{title}</h2>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {lines.map((l, i) => (
          <li key={i} className="flex items-baseline gap-3 px-4 py-2.5 text-[15px]">
            <span className="w-14 shrink-0 text-sm text-muted-foreground">{shortDate(l.at)}</span>
            <span className="min-w-0 flex-1">{l.what}</span>
            <span className="shrink-0 font-semibold">{tokens(l.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function MemberRecap({ username, year, month }: { username: string; year: string; month: string }) {
  if (!(await isMember())) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-foreground">{monthName(year, month)} at the Commons Hub</h1>
        <SignInPrompt>Members only: log in to see this month.</SignInPrompt>
      </main>
    )
  }
  const r = await loadRecap(decodeURIComponent(username), year, month)
  if (!r) notFound()
  const prev = shift(year, month, -1)
  const next = shift(year, month, 1)
  const now = new Date()
  const hasNext = Number(next.year) * 12 + Number(next.month) <= now.getFullYear() * 12 + now.getMonth() + 1
  const base = `/${encodeURIComponent(r.member.username)}`

  return (
    <main className="mx-auto max-w-3xl px-4 pb-14 pt-10 sm:px-6">
      <div className="flex items-center gap-4">
        {r.member.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getProxiedImageUrl(r.member.avatar, "xs", { relative: true })} alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
            {r.member.name}’s {monthName(year, month)}
          </h1>
          <nav className="mt-1 flex gap-4 text-sm">
            <Link href={`${base}/${prev.year}/${prev.month}`} className="inline-flex items-center text-primary hover:underline">
              <ChevronLeft className="h-4 w-4" /> {monthName(prev.year, prev.month, false)}
            </Link>
            {hasNext && (
              <Link href={`${base}/${next.year}/${next.month}`} className="inline-flex items-center text-primary hover:underline">
                {monthName(next.year, next.month, false)} <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
        <Stat value={String(r.days)} label={r.days === 1 ? "day at the hub" : "days at the hub"} />
        <Stat value={`+${r.receivedTotal}`} label="tokens received" />
        <Stat value={`−${r.spentTotal}`} label="tokens spent" />
      </div>

      <Lines title="Tokens received" lines={r.received} />
      <Lines title="Tokens spent" lines={r.spent} />

      {r.praise.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-bold text-foreground">💝 {r.praise.length === 1 ? "A thank-you" : `${r.praise.length} thank-yous`}</h2>
          <ul className="space-y-3">
            {r.praise.map((p, i) => (
              <li key={i} className="rounded-2xl bg-muted px-4 py-3">
                <p className="text-[15px] text-foreground">“{p.text}”</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  {p.from.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getProxiedImageUrl(p.from.avatar, "xs", { relative: true })} alt="" width={20} height={20} className="h-5 w-5 rounded-full" />
                  )}
                  {p.from.name} · {shortDate(p.at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r.photos.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-lg font-bold text-foreground">Shared in #contributions</h2>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {r.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={getProxiedImageUrl(p.src, "sm", { relative: true })} alt={p.text || `Shared by ${p.by}`} title={p.text ? `${p.by}: ${p.text}` : p.by} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-foreground">See you at the hub</h2>
        <Link href="/shifts" className="flex items-center gap-4 rounded-2xl border-2 border-primary p-5 transition hover:bg-primary/5">
          <HeartHandshake className="h-8 w-8 shrink-0 text-primary" />
          <span>
            <span className="block text-lg font-bold text-foreground">Sign up for a shift</span>
            <span className="block text-sm text-muted-foreground">Welcome people at the hub when it’s open. Shifts earn tokens.</span>
          </span>
        </Link>
        {r.events.length > 0 && (
          <>
            <h3 className="mb-2 mt-6 flex items-center gap-2 font-semibold text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" /> Or come to an upcoming event
            </h3>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {r.events.map((e, i) => (
                <li key={i}>
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-0.5 px-4 py-3 transition hover:bg-muted sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-36 shrink-0 text-sm text-primary">{eventWhen(e.start)}</span>
                    <span className="min-w-0 font-medium text-foreground">{e.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {r.days === 0 && r.received.length === 0 && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <DoorOpen className="h-4 w-4" /> No visits recorded at the door this month.
        </p>
      )}
    </main>
  )
}
