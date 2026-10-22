"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DoorOpen, MapPin, Clock, Ticket, UserRound } from "lucide-react"

import { parsePass, passCost, passState, PASS_DISCLAIMER, type Pass } from "@/lib/guest-pass"

const ADDRESS = "Rue de la Madeleine 51, 1000 Brussels"
const MAP_URL = "https://www.openstreetmap.org/search?query=Rue%20de%20la%20Madeleine%2051%2C%201000%20Brussels"
const TZ = "Europe/Brussels"

const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })
const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })

/**
 * A guest pass, read from the URL fragment only (never sent to the server):
 * who it's for, when the door opens for them, where, what it costs, and a big
 * button that opens the real signed door link.
 */
export function PassView() {
  const [pass, setPass] = useState<Pass | null | undefined>(undefined)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const read = () => setPass(parsePass(window.location.hash))
    read()
    window.addEventListener("hashchange", read)
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => {
      window.removeEventListener("hashchange", read)
      clearInterval(timer)
    }
  }, [])

  if (pass === undefined) return <div className="min-h-[60vh]" />
  if (pass === null) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Ticket className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold text-foreground">This pass link is incomplete</h1>
        <p className="mt-2 text-muted-foreground">Ask the member who invited you to send the link again, in full.</p>
      </div>
    )
  }

  const state = passState(pass, now)
  const sameDay = day(pass.from) === day(pass.until)
  const when = `${day(pass.from)}, ${time(pass.from)}–${time(pass.until)}${sameDay ? "" : ` (${day(pass.until)})`}`

  return (
    <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="bg-primary px-6 py-5 text-primary-foreground">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-90">Coworking pass · {pass.length === "day" ? "full day" : "half day"}</p>
          <h1 className="mt-1 break-words text-3xl font-extrabold leading-tight">{pass.guest}</h1>
        </div>

        <div className="space-y-3 px-6 py-5 text-[15px]">
          <p className="flex items-start gap-3"><UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>Invited by <strong>{pass.host}</strong></span></p>
          <p className="flex items-start gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{when}</span></p>
          <p className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <a href={MAP_URL} className="underline decoration-primary/40 underline-offset-2" target="_blank" rel="noreferrer">{ADDRESS}</a>
              <br />
              <span className="text-muted-foreground">Right in front of Brussels Central Station</span>
            </span>
          </p>
          <p className="flex items-start gap-3"><Ticket className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{passCost(pass.length)}, paid by {pass.host}</span></p>
        </div>

        <div className="border-t border-dashed border-border px-6 py-6 text-center">
          {state === "active" ? (
            <>
              <a
                href={pass.doorUrl}
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-3 rounded-xl bg-foreground px-8 py-4 text-lg font-bold text-background shadow-sm transition-transform active:scale-95"
              >
                <DoorOpen className="h-6 w-6" />
                Open the door
              </a>
              <p className="mt-3 text-sm text-muted-foreground">Tap it when you are at the door. Works until {time(pass.until)}.</p>
            </>
          ) : state === "upcoming" ? (
            <>
              <p className="text-lg font-semibold text-foreground">Your pass starts {day(pass.from) === day(now) ? "today" : day(pass.from)} at {time(pass.from)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Come back to this page then: the &ldquo;Open the door&rdquo; button appears when your pass starts.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-foreground">This pass has expired</p>
              <p className="mt-1 text-sm text-muted-foreground">It worked until {time(pass.until)} on {day(pass.until)}. Ring the bell, or ask {pass.host} for a new one.</p>
            </>
          )}
        </div>
      </div>

      <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>The link is personal: please don&apos;t share it. Everyone in the community sees in our #door channel that you opened the door.</li>
        <li>Please close the door behind you. If it doesn&apos;t work, ring the bell or contact {pass.host}.</li>
      </ul>

      <h2 className="mt-8 text-lg font-bold text-foreground">A community space</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">
        The Commons Hub is a community space, not a rental venue. Please treat it as if it were your own house (unless you are messy at home 🙂).
        If you like the place, become a member: members call this place home, book rooms, and steward it together with us.
      </p>
      <p className="mt-4 text-center">
        <Link href="/apply" className="inline-flex rounded-lg border-2 border-primary px-5 py-2 font-semibold text-primary hover:bg-primary/5">
          Become a member
        </Link>
      </p>

      <p className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{PASS_DISCLAIMER}</p>
    </div>
  )
}
