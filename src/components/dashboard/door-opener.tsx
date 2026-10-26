"use client"

import { useState } from "react"
import { DoorOpen, RotateCcw } from "lucide-react"

import type { DoorVisitor } from "@/lib/door-today"
import { Door3D, type DoorState } from "./door-3d"

/**
 * The dashboard's "Open the door", without leaving the page: the door in 3D
 * (Door3D) is knocked on while the server opens it (POST /api/door/open),
 * then swings open, and who is at the hub today shows under it, with what
 * they last contributed. Without JavaScript it is a plain form that goes to
 * the door.
 *
 * `demo` (the /door/preview page) plays it all without opening the door:
 * it waits as long as a real knock and shows the visitors it was given.
 */

type State = { step: "idle" } | { step: "knocking" } | { step: "open"; visitors: DoorVisitor[]; greeting: string } | { step: "stuck"; error: string }

const GREETINGS = ["Come on in, {name}.", "Welcome home, {name}.", "In you go, {name}.", "The commons await, {name}.", "Door's open, {name}. Give it a push."]

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" })
const ago = (ms: number, now = Date.now()) => {
  const days = Math.floor((now - ms) / 86_400_000)
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 14 ? `${days} days ago` : `${Math.round(days / 7)} weeks ago`
}

export function DoorOpener({ name, demo }: { name: string; demo?: { visitors: DoorVisitor[]; fail?: boolean } }) {
  const [state, setState] = useState<State>({ step: "idle" })

  async function open(e: React.FormEvent | React.MouseEvent) {
    e.preventDefault()
    if (state.step === "knocking") return
    setState({ step: "knocking" })
    // Knock at least a moment, even when the door answers at once: it's half the fun.
    const knock = new Promise((r) => setTimeout(r, demo ? 1800 : 1100))
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace("{name}", name)
    if (demo) {
      await knock
      return setState(demo.fail ? { step: "stuck", error: "The door didn't answer. Try again in a moment." } : { step: "open", visitors: demo.visitors, greeting })
    }
    try {
      const res = await fetch("/api/door/open", { method: "POST", headers: { Accept: "application/json" } })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; visitors?: DoorVisitor[]; error?: string }
      await knock
      if (!res.ok || !body.ok) return setState({ step: "stuck", error: body.error || "The door didn't answer. Try again in a moment." })
      setState({ step: "open", visitors: body.visitors ?? [], greeting })
    } catch {
      await knock
      setState({ step: "stuck", error: "No connection. Try again in a moment." })
    }
  }

  const opened = state.step === "open"
  const busy = state.step === "knocking"
  const scene: DoorState = state.step
  return (
    <>
      <style>{CSS}</style>
      <form action="/api/door/open" method="post" onSubmit={open} className="h-full">
        <button type="submit" disabled={busy} className="flex h-full w-full items-center gap-4 rounded-2xl bg-primary p-5 text-left text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-80">
          <DoorOpen className="h-8 w-8 shrink-0" />
          <span>
            <span className="block text-lg font-bold">{opened ? "Door open, come in!" : busy ? "Knock knock…" : "Open the door"}</span>
            <span className="block text-sm opacity-90">{opened ? "Tap to open it again" : "Rue de la Madeleine 51"}</span>
          </span>
        </button>
      </form>
      {/* Under both buttons on a wide screen, right under this one on a phone. */}
      {state.step !== "idle" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card sm:order-last sm:col-span-2" aria-live="polite">
          <div className="relative">
            <Door3D state={scene} visitors={opened ? state.visitors : []} me={name} className="h-80 sm:h-[26rem]" />
            {busy && <p className="door-rise absolute inset-x-0 bottom-4 text-center text-sm font-semibold tracking-wide text-white drop-shadow">Knocking…</p>}
          </div>

          <div className="p-5 sm:p-6">
            {state.step === "stuck" && (
              <div className="text-center">
                <p className="font-semibold text-foreground">The door didn&apos;t open</p>
                <p className="mt-1 text-sm text-muted-foreground">{state.error}</p>
                <button onClick={open} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  <RotateCcw className="h-4 w-4" /> Knock again
                </button>
              </div>
            )}
            {busy && <p className="text-center text-muted-foreground">Asking the door…</p>}
            {opened && (
              <>
                <p className="door-rise text-center text-2xl font-extrabold text-foreground" style={{ animationDelay: "1.2s" }}>
                  {state.greeting}
                </p>
                <p className="door-rise mt-1 text-center text-sm text-muted-foreground" style={{ animationDelay: "1.4s" }}>
                  The door is unlocked: give it a push.
                </p>
                <Visitors visitors={state.visitors} name={name} />
                <div className="mt-5 flex justify-center">
                  <button onClick={() => setState({ step: "idle" })} className="rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Visitors({ visitors, name }: { visitors: DoorVisitor[]; name: string }) {
  const others = visitors.filter((v) => v.name !== name)
  if (others.length === 0) {
    return (
      <div className="door-rise mt-6 rounded-xl bg-muted p-5 text-center" style={{ animationDelay: "1.8s" }}>
        <p className="text-lg font-bold text-foreground">You&apos;re the first one here today</p>
        <p className="mt-1 text-sm text-muted-foreground">The hub is all yours for now. Lights on, kettle on.</p>
      </div>
    )
  }
  return (
    <div className="mt-6">
      <h3 className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Already at the hub today · {others.length}
      </h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {others.map((v, i) => (
          <li key={`${v.name}-${v.arrivedAt}`} className="door-rise flex gap-3 rounded-xl border border-border bg-background p-3" style={{ animationDelay: `${1.8 + i * 0.1}s` }}>
            {v.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.avatar} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">{v.name.charAt(0).toUpperCase()}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-foreground">{v.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {v.guest ? "guest · " : ""}since {time(v.arrivedAt)}
                </span>
              </span>
              {v.lastContribution ? (
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  <span className="line-clamp-2">“{v.lastContribution.text}”</span>
                  <span className="text-xs">last contribution, {ago(v.lastContribution.at)}</span>
                </span>
              ) : (
                <span className="mt-0.5 block text-sm text-muted-foreground">{v.guest ? "Visiting today" : "No contribution shared lately"}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const CSS = `
.door-rise { animation: door-rise .6s cubic-bezier(.2,.8,.2,1) both; }
@keyframes door-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .door-rise { animation: none; } }
`
