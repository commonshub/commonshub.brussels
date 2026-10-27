import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight, DoorOpen, HeartHandshake } from "lucide-react"

import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { isMember } from "@/lib/admin-check"
import { getProxiedImageUrl } from "@/lib/image-proxy"
import { lineText, loadRecap, periodName, periodPath, shiftPeriod, shortDate, tokens, type Period, type TokenLine } from "@/lib/monthly-recap"

/**
 * /<username>/<year>/<month>, /<username>/<year>/Q<n> and /<username>/<year>:
 * a member's month, quarter or year at the hub, the online version of the
 * recap email (lib/monthly-recap-email.ts). Members only: it says how often
 * someone came.
 */

const eventWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })

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
            <span className="min-w-0 flex-1">{lineText(l)}</span>
            <span className="shrink-0 font-semibold">{tokens(l.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const SPAN = { month: "month", quarter: "quarter", year: "year" }

export async function MemberRecap({ username, period }: { username: string; period: Period }) {
  if (!(await isMember())) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-foreground">{periodName(period)} at the Commons Hub</h1>
        <SignInPrompt>Members only: log in to see this {SPAN[period.kind]}.</SignInPrompt>
      </main>
    )
  }
  const r = await loadRecap(decodeURIComponent(username), period)
  if (!r) notFound()
  const prev = shiftPeriod(period, -1)
  const next = shiftPeriod(period, 1)
  const now = new Date()
  const hasNext = Number(next.year) * 12 + Number(next.months[0]) <= now.getFullYear() * 12 + now.getMonth() + 1
  const base = `/${encodeURIComponent(r.member.username)}`
  const other = (["month", "quarter", "year"] as const).filter((k) => k !== period.kind)
  const sameTime = (k: Period["kind"]) => {
    const m = Number(period.months[0])
    return k === "year" ? period.year : k === "quarter" ? `${period.year}/Q${Math.floor((m - 1) / 3) + 1}` : `${period.year}/${period.months[0]}`
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-14 pt-10 sm:px-6">
      <div className="flex items-center gap-4">
        {r.member.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getProxiedImageUrl(r.member.avatar, "xs", { relative: true })} alt="" width={56} height={56} className="h-14 w-14 rounded-full" />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
            {r.member.name}’s {periodName(period)}
          </h1>
          <nav className="mt-1 flex gap-4 text-sm">
            <Link href={`${base}/${periodPath(prev)}`} className="inline-flex items-center text-primary hover:underline">
              <ChevronLeft className="h-4 w-4" /> {periodName(prev, prev.year !== period.year || period.kind === "year")}
            </Link>
            {hasNext && (
              <Link href={`${base}/${periodPath(next)}`} className="inline-flex items-center text-primary hover:underline">
                {periodName(next, next.year !== period.year || period.kind === "year")} <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
          <nav className="mt-1 flex gap-3 text-sm text-muted-foreground">
            See the{" "}
            {other.map((k) => (
              <Link key={k} href={`${base}/${sameTime(k)}`} className="underline hover:text-foreground">
                {SPAN[k]}
              </Link>
            ))}
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
          <DoorOpen className="h-4 w-4" /> No visits recorded at the door this {SPAN[period.kind]}.
        </p>
      )}
    </main>
  )
}
