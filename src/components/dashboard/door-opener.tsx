"use client"

import { useState } from "react"
import { DoorOpen, RotateCcw } from "lucide-react"

import type { DoorVisitor } from "@/lib/door-today"

/**
 * The dashboard's "Open the door", without leaving the page: knock knock
 * while the server opens it (POST /api/door/open), then the door swings
 * open on a warm room, a little confetti, and who came to the hub today
 * pops in underneath. Without JavaScript it is a plain form that goes to the
 * door. Calm for people who ask for reduced motion.
 */

type State = { step: "idle" } | { step: "knocking" } | { step: "open"; visitors: DoorVisitor[]; greeting: string } | { step: "stuck"; error: string }

const GREETINGS = ["Come on in, {name}! 🎉", "Welcome home, {name}! 🏡", "Ta-da! In you go, {name} ✨", "The commons await, {name} 🌱", "Door's open, {name}. Push! 💪"]
const CONFETTI = ["🎉", "✨", "🧡", "🌱", "☕", "🎈", "⭐", "🪴", "💛", "🎊", "🌼", "✨"]

const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" })

export function DoorOpener({ name }: { name: string }) {
  const [state, setState] = useState<State>({ step: "idle" })

  async function open(e: React.FormEvent) {
    e.preventDefault()
    if (state.step === "knocking") return
    setState({ step: "knocking" })
    // Knock at least a moment, even when the door answers at once: it's half the fun.
    const knock = new Promise((r) => setTimeout(r, 1100))
    try {
      const res = await fetch("/api/door/open", { method: "POST", headers: { Accept: "application/json" } })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; visitors?: DoorVisitor[]; error?: string }
      await knock
      if (!res.ok || !body.ok) return setState({ step: "stuck", error: body.error || "The door didn't answer. Try again in a moment." })
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace("{name}", name)
      setState({ step: "open", visitors: body.visitors ?? [], greeting })
    } catch {
      await knock
      setState({ step: "stuck", error: "No connection. Try again in a moment." })
    }
  }

  const opened = state.step === "open"
  const busy = state.step === "knocking"
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
          <div className="relative flex h-64 items-end justify-center overflow-hidden bg-gradient-to-b from-sky-200 to-sky-100 dark:from-slate-800 dark:to-slate-900">
            {/* The facade */}
            <div className="absolute inset-x-0 bottom-0 h-8 bg-stone-300 dark:bg-stone-700" />
            <div className="relative mb-8 h-48 w-32" style={{ perspective: "700px" }}>
              {/* The room behind the door */}
              <div className="absolute inset-0 overflow-hidden rounded-t-[3rem] bg-gradient-to-b from-amber-200 via-amber-100 to-orange-100">
                <div className={`door-room absolute inset-0 flex items-end justify-center gap-1 pb-3 text-2xl ${opened ? "door-room-lit" : ""}`}>
                  <span className="door-bob" style={{ animationDelay: "0.5s" }}>🪴</span>
                  <span className="door-bob" style={{ animationDelay: "0.7s" }}>☕</span>
                  <span className="door-bob" style={{ animationDelay: "0.9s" }}>🛋️</span>
                </div>
                <div className="absolute left-1/2 top-3 -translate-x-1/2 text-xl">💡</div>
              </div>
              {/* The door */}
              <div
                className={`door-panel absolute inset-0 flex items-center justify-end rounded-t-[3rem] border-4 border-[color-mix(in_oklch,var(--primary),black_25%)] bg-primary pr-3 shadow-lg ${state.step === "knocking" ? "door-knock" : ""} ${opened ? "door-open" : ""} ${state.step === "stuck" ? "door-stuck" : ""}`}
              >
                <span className="absolute inset-x-4 top-8 h-14 rounded-t-[2rem] border-2 border-white/30" />
                <span className="absolute inset-x-4 bottom-4 h-16 rounded border-2 border-white/30" />
                <span className="relative h-4 w-4 rounded-full bg-amber-300 shadow" />
              </div>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-stone-800 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">N°51</div>
            </div>
            {state.step === "knocking" && (
              <div className="door-knock-text absolute right-6 top-6 rotate-6 rounded-xl bg-white px-3 py-1 text-sm font-bold text-stone-800 shadow dark:bg-stone-100">Knock knock… ✊</div>
            )}
            {opened && (
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {CONFETTI.map((c, i) => (
                  <span key={i} className="door-confetti absolute left-1/2 top-1/2 text-xl" style={{ ["--dx" as string]: `${Math.cos((i / CONFETTI.length) * Math.PI * 2) * (90 + (i % 3) * 40)}px`, ["--dy" as string]: `${Math.sin((i / CONFETTI.length) * Math.PI * 2) * (70 + (i % 4) * 20) - 40}px`, animationDelay: `${0.35 + (i % 4) * 0.05}s` }}>
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-5">
            {state.step === "knocking" && <p className="text-center font-semibold text-foreground">Asking the door nicely…</p>}
            {state.step === "stuck" && (
              <div className="text-center">
                <p className="font-semibold text-foreground">Hmm, the door is shy today 🙈</p>
                <p className="mt-1 text-sm text-muted-foreground">{state.error}</p>
                <button onClick={open} className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  <RotateCcw className="h-4 w-4" /> Knock again
                </button>
              </div>
            )}
            {opened && (
              <>
                <p className="door-pop text-center text-xl font-extrabold text-foreground">{state.greeting}</p>
                <p className="mt-1 text-center text-sm text-muted-foreground">The door is unlocked: give it a push.</p>
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
  return (
    <div className="mt-6">
      <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">At the hub today</h3>
      {others.length === 0 ? (
        <p className="door-pop mt-3 text-center text-foreground" style={{ animationDelay: "0.9s" }}>
          You&apos;re the first one today! ☀️ Put the kettle on?
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-4">
          {visitors.map((v, i) => (
            <li key={`${v.name}-${v.arrivedAt}`} className="door-pop flex w-20 flex-col items-center text-center" style={{ animationDelay: `${0.8 + i * 0.12}s` }}>
              <span className="relative">
                {v.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.avatar} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover ring-2 ring-background" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">{v.name.charAt(0).toUpperCase()}</span>
                )}
                {v.name === name && <span className="absolute -bottom-1 -right-1 text-base">👋</span>}
              </span>
              <span className="mt-1 w-full truncate text-sm font-semibold text-foreground">{v.name === name ? "You" : v.name}</span>
              <span className="text-xs text-muted-foreground">
                {v.guest ? "guest · " : ""}
                {time(v.arrivedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const CSS = `
.door-panel { transform-origin: left center; transition: transform 1.1s cubic-bezier(.3,1.4,.5,1); }
.door-open { transform: rotateY(-78deg); }
.door-room { opacity: .35; transition: opacity .6s .3s; }
.door-room-lit { opacity: 1; }
.door-knock { animation: door-knock .55s ease-in-out infinite; }
.door-stuck { animation: door-stuck .5s ease-in-out 2; }
.door-knock-text { animation: door-pop .3s ease-out both; }
.door-bob { display: inline-block; opacity: 0; }
.door-room-lit .door-bob { animation: door-bob .6s cubic-bezier(.3,1.6,.5,1) both; }
.door-confetti { opacity: 0; animation: door-confetti 1.3s ease-out both; }
.door-pop { animation: door-pop .45s cubic-bezier(.3,1.6,.5,1) both; }
@keyframes door-knock { 0%, 100% { transform: rotate(0); } 20% { transform: rotate(-1.5deg) translateX(-2px); } 40% { transform: rotate(1.5deg) translateX(2px); } 60% { transform: rotate(-.8deg); } }
@keyframes door-stuck { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@keyframes door-bob { from { opacity: 0; transform: translateY(14px) scale(.6); } to { opacity: 1; transform: none; } }
@keyframes door-confetti { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 60px)) scale(1) rotate(200deg); } }
@keyframes door-pop { from { opacity: 0; transform: scale(.6) translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .door-panel { transition: none; }
  .door-knock, .door-stuck, .door-confetti, .door-bob, .door-pop, .door-knock-text, .door-room-lit .door-bob { animation: none !important; opacity: 1; }
  .door-confetti { display: none; }
}
`
