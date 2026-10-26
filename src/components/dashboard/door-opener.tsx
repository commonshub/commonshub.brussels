"use client"

import { useState } from "react"
import { DoorClosed, DoorOpen, RotateCcw } from "lucide-react"

import type { DoorVisitor } from "@/lib/door-today"

/**
 * The dashboard's "Open the door", without leaving the page: the door icon
 * knocks while the server opens it (POST /api/door/open), then swings open,
 * and who came to the hub today pops in underneath. Without JavaScript it is
 * a plain form that goes to the door. Calm for people who ask for reduced
 * motion.
 *
 * `demo` (the /door/preview page) plays it all without opening the door:
 * it waits as long as a real knock and shows the visitors it was given.
 */

type State = { step: "idle" } | { step: "knocking" } | { step: "open"; visitors: DoorVisitor[] } | { step: "stuck"; error: string }

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" })

export function DoorOpener({ name, demo }: { name: string; demo?: { visitors: DoorVisitor[]; fail?: boolean } }) {
  const [state, setState] = useState<State>({ step: "idle" })

  async function open(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault()
    if (state.step === "knocking") return
    setState({ step: "knocking" })
    // Knock at least a moment, even when the door answers at once: it's half the fun.
    const knock = new Promise((r) => setTimeout(r, 1100))
    if (demo) {
      await knock
      return setState(demo.fail ? { step: "stuck", error: "The door didn't answer. Try again in a moment." } : { step: "open", visitors: demo.visitors })
    }
    try {
      const res = await fetch("/api/door/open", { method: "POST", headers: { Accept: "application/json" } })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; visitors?: DoorVisitor[]; error?: string }
      await knock
      if (!res.ok || !body.ok) return setState({ step: "stuck", error: body.error || "The door didn't answer. Try again in a moment." })
      setState({ step: "open", visitors: body.visitors ?? [] })
    } catch {
      await knock
      setState({ step: "stuck", error: "No connection. Try again in a moment." })
    }
  }

  const opened = state.step === "open"
  const busy = state.step === "knocking"
  const Icon = opened ? DoorOpen : DoorClosed
  return (
    <>
      <style>{CSS}</style>
      <form action="/api/door/open" method="post" onSubmit={open} className="h-full">
        <button type="submit" disabled={busy} className="flex h-full w-full items-center gap-4 rounded-2xl bg-primary p-5 text-left text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-90">
          <span className="relative shrink-0">
            {opened && <span className="door-ring absolute inset-0 rounded-full" aria-hidden />}
            <Icon key={state.step} className={`h-8 w-8 ${busy ? "door-knock" : opened ? "door-swing" : state.step === "stuck" ? "door-stuck" : ""}`} />
          </span>
          <span>
            <span className="block text-lg font-bold">{opened ? "Door open, come in!" : busy ? "Knock knock…" : state.step === "stuck" ? "The door didn't open" : "Open the door"}</span>
            <span className="block text-sm opacity-90">{opened ? "Give it a push · tap to open it again" : state.step === "stuck" ? "Tap to try again" : "Rue de la Madeleine 51"}</span>
          </span>
        </button>
      </form>
      {/* Under both buttons on a wide screen, right under this one on a phone. */}
      {(opened || state.step === "stuck") && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:order-last sm:col-span-2" aria-live="polite">
          {state.step === "stuck" && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{state.error}</p>
              <button onClick={open} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <RotateCcw className="h-4 w-4" /> Knock again
              </button>
            </div>
          )}
          {opened && <Visitors visitors={state.visitors} name={name} />}
          {opened && (
            <div className="mt-4 flex justify-center">
              <button onClick={() => setState({ step: "idle" })} className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Visitors({ visitors, name }: { visitors: DoorVisitor[]; name: string }) {
  const others = visitors.filter((v) => v.name !== name)
  if (others.length === 0) return <p className="door-pop text-center font-semibold text-foreground">You&apos;re the first one here today.</p>
  return (
    <div>
      <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">Already at the hub today</h3>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-4">
        {others.map((v, i) => (
          <li key={`${v.name}-${v.arrivedAt}`} className="door-pop flex w-20 flex-col items-center text-center" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
            {v.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.avatar} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover ring-2 ring-background" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">{v.name.charAt(0).toUpperCase()}</span>
            )}
            <span className="mt-1 w-full truncate text-sm font-semibold text-foreground">{v.name}</span>
            <span className="text-xs text-muted-foreground">
              {v.guest ? "guest · " : ""}
              {time(v.arrivedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const CSS = `
.door-knock { animation: door-knock .6s ease-in-out infinite; transform-origin: 50% 90%; }
.door-swing { animation: door-swing .7s cubic-bezier(.3,1.6,.5,1) both; }
.door-stuck { animation: door-stuck .45s ease-in-out 2; }
.door-ring { animation: door-ring .9s ease-out both; box-shadow: 0 0 0 0 rgba(255,255,255,.7); }
.door-pop { animation: door-pop .45s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes door-knock { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(-9deg); } 30% { transform: rotate(7deg); } 45% { transform: rotate(-4deg); } 60% { transform: rotate(0); } }
@keyframes door-swing { from { transform: perspective(60px) rotateY(-50deg) scale(.8); opacity: .4; } to { transform: none; opacity: 1; } }
@keyframes door-stuck { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes door-ring { from { box-shadow: 0 0 0 0 rgba(255,255,255,.7); } to { box-shadow: 0 0 0 22px rgba(255,255,255,0); } }
@keyframes door-pop { from { opacity: 0; transform: scale(.6) translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .door-knock, .door-swing, .door-stuck, .door-ring, .door-pop { animation: none !important; opacity: 1; }
}
`
