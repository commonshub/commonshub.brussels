"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Maximize, X } from "lucide-react"

import Image from "@/components/optimized-image"
import { ElinorChat, MarketChat, MintChat } from "@/components/token/elinor-chat"
import { EARN, GUEST_PASS_SCREENS, ROLES, ROOM_TOKENS, tokens } from "@/lib/token-story"

const way = (id: string) => EARN.find((w) => w.id === id)!

function Photo({ src, alt, className = "", position = "object-center" }: { src: string; alt: string; className?: string; position?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-muted ${className}`}>
      <Image src={src} alt={alt} fill sizes="60vw" className={`object-cover ${position}`} />
    </div>
  )
}

function Amount({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-primary px-4 py-1.5 text-[clamp(14px,1.6vw,22px)] font-bold text-primary-foreground">{children}</span>
}

/** A slide with a photo on one side and the words on the other (stacked on a phone). */
function EarnSlide({ id, children }: { id: string; children?: React.ReactNode }) {
  const w = way(id)
  return (
    <div className="grid h-full items-center gap-[4vmin] md:grid-cols-[1.2fr_1fr]">
      <div className="flex h-full min-h-0 flex-col gap-3">
        {w.visual === "market" ? (
          <div className="flex min-h-0 flex-1 items-center overflow-hidden">
            <MarketChat className="w-full" />
          </div>
        ) : (
          <Photo src={w.photo!} alt={w.photoAlt ?? ""} className="min-h-[30vh] flex-1" position={id === "shifts" ? "object-left-top" : "object-center"} />
        )}
        {w.more && (
          <div className="hidden h-[22vh] gap-3 md:grid" style={{ gridTemplateColumns: `repeat(${w.more.length}, minmax(0, 1fr))` }}>
            {w.more.map((m) => (
              <Photo key={m.src} src={m.src} alt={m.alt} className="h-full" />
            ))}
          </div>
        )}
      </div>
      <div>
        <Amount>{w.amount}</Amount>
        <h2 className="mt-4 text-[clamp(32px,5vw,72px)] font-extrabold leading-[1.05] text-foreground">{w.title}</h2>
        <p className="mt-4 text-[clamp(16px,1.7vw,24px)] leading-relaxed text-muted-foreground">{w.text}</p>
        {children}
      </div>
    </div>
  )
}

const SLIDES: Array<{ title: string; render: () => React.ReactNode }> = [
  {
    title: "The Commons Hub Token",
    render: () => (
      <div className="grid h-full items-center gap-[4vmin] md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-[clamp(14px,1.5vw,22px)] font-semibold uppercase tracking-wide text-primary">The Commons Hub Token</p>
          <h1 className="mt-3 text-[clamp(40px,7vw,110px)] font-extrabold leading-[0.95] text-foreground">
            Take care of the community.
            <br />
            <span className="text-primary">Get tokens.</span>
          </h1>
        </div>
        <Photo src={way("heartbeat").photo!} alt={way("heartbeat").photoAlt!} className="h-[38vh] md:h-[70vh]" />
      </div>
    ),
  },
  {
    title: "An abundant currency",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <div className="grid gap-[4vmin] md:grid-cols-2">
          <div className="rounded-3xl bg-muted p-[4vmin]">
            <p className="text-[clamp(28px,4vw,60px)] font-extrabold text-foreground">Euros</p>
            <p className="mt-3 text-[clamp(16px,2vw,28px)] text-muted-foreground">are scarce. They measure what we sell, and make us compete for them.</p>
          </div>
          <div className="rounded-3xl bg-primary p-[4vmin] text-primary-foreground">
            <p className="text-[clamp(28px,4vw,60px)] font-extrabold">Our token</p>
            <p className="mt-3 text-[clamp(16px,2vw,28px)] opacity-95">is abundant. It comes into existence whenever a member gives time, energy and care to the community.</p>
          </div>
        </div>
        <p className="mt-[5vmin] text-center text-[clamp(18px,2.4vw,34px)] font-semibold text-foreground">And it&apos;s spent on what the hub has to spare.</p>
      </div>
    ),
  },
  { title: "Come to the Heartbeat", render: () => <EarnSlide id="heartbeat" /> },
  {
    title: "Minted by asking Elinor",
    render: () => (
      <div className="grid h-full items-center gap-[4vmin] md:grid-cols-[1fr_1.1fr]">
        <div>
          <Amount>1 token each</Amount>
          <h2 className="mt-4 text-[clamp(30px,4.6vw,70px)] font-extrabold leading-[1.05] text-foreground">Minted by asking Elinor</h2>
          <p className="mt-4 text-[clamp(16px,1.7vw,24px)] leading-relaxed text-muted-foreground">
            After the Heartbeat, a steward asks Elinor to issue a token to everyone who came. She proposes the mint, the steward confirms, and the tokens land in everyone&apos;s wallet.
          </p>
        </div>
        <div className="max-h-[62vh] overflow-hidden md:max-h-[80vh]">
          <MintChat className="origin-top md:scale-[0.92]" />
        </div>
      </div>
    ),
  },
  { title: "Clean the park", render: () => <EarnSlide id="park" /> },
  {
    title: "Pick up a role",
    render: () => (
      <EarnSlide id="roles">
        <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-[clamp(13px,1.3vw,18px)]">
          {ROLES.slice(0, 8).map((r) => (
            <li key={r.name} className="flex justify-between gap-2 border-b border-border py-0.5">
              <span className="truncate text-foreground">{r.name.replace(" steward", "")}</span>
              <span className="shrink-0 text-muted-foreground">{tokens(r.tokens)}</span>
            </li>
          ))}
        </ul>
      </EarnSlide>
    ),
  },
  { title: "Steward a shift", render: () => <EarnSlide id="shifts" /> },
  { title: "Offers and needs", render: () => <EarnSlide id="market" /> },
  {
    title: "Anything else",
    render: () => (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h2 className="text-[clamp(32px,5.5vw,84px)] font-extrabold leading-tight text-foreground">Did something else for the community?</h2>
        <p className="mt-5 max-w-4xl text-[clamp(18px,2.2vw,32px)] text-muted-foreground">
          Share it in <strong className="text-foreground">#contributions</strong> on Discord, or use <code className="rounded bg-muted px-2">/claim</code>. We look at contributions together at the Heartbeat and reward them.
        </p>
      </div>
    ),
  },
  {
    title: "What you can do with them",
    render: () => (
      <div className="flex h-full flex-col justify-center">
        <h2 className="text-[clamp(32px,5vw,76px)] font-extrabold text-foreground">What you can do with them</h2>
        <div className="mt-[4vmin] grid gap-[3vmin] md:grid-cols-3">
          {[
            ["Cowork", `${tokens(1)} for half a day, ${tokens(2)} for a day, at a desk that's free today.`],
            ["Invite a friend", `A pass that opens the door: ${tokens(1)} for half a day, ${tokens(2)} for a day.`],
            ["Book a room", "From ½ token an hour (phone booth) to 3 (Ostrom Room)."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-3xl bg-muted p-[3.5vmin]">
              <p className="text-[clamp(22px,2.8vw,42px)] font-bold text-foreground">{t}</p>
              <p className="mt-2 text-[clamp(15px,1.6vw,24px)] text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-[3vmin] text-[clamp(12px,1.1vw,16px)] text-muted-foreground">Only when the space is free: no guaranteed desk or room, a bit like Too Good To Go.</p>
      </div>
    ),
  },
  {
    title: "A pass for a friend",
    render: () => (
      <div className="flex h-full flex-col">
        <h2 className="text-[clamp(26px,3.6vw,56px)] font-extrabold text-foreground">A coworking pass for a friend, from your phone</h2>
        <div className="mt-[3vmin] grid min-h-0 flex-1 grid-cols-2 gap-[2vmin] md:grid-cols-4">
          {GUEST_PASS_SCREENS.map((s, i) => (
            <figure key={s.src} className="flex min-h-0 flex-col items-center">
              <div className="relative aspect-[390/844] h-full max-h-[62vh] overflow-hidden rounded-xl border border-border bg-muted shadow-sm md:max-h-[66vh]">
                <Image src={s.src} alt={s.alt} fill sizes="25vw" className="object-cover object-top" />
              </div>
              <figcaption className="mt-2 text-center text-[clamp(12px,1.2vw,18px)] text-muted-foreground">
                <span className="font-bold text-foreground">{i + 1}.</span> {s.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Book a room with Elinor",
    render: () => (
      <div className="grid h-full items-center gap-[4vmin] md:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-[clamp(30px,4.6vw,70px)] font-extrabold leading-[1.05] text-foreground">Book a room, just by asking Elinor</h2>
          <p className="mt-4 text-[clamp(16px,1.7vw,24px)] text-muted-foreground">She proposes it on Discord, and you pay with your tokens in one tap.</p>
          <ul className="mt-5 hidden space-y-1 text-[clamp(13px,1.3vw,19px)] md:block">
            {ROOM_TOKENS.map((r) => (
              <li key={r.name} className="flex justify-between gap-3 border-b border-border py-0.5">
                <span className="text-foreground">
                  {r.name}
                  {r.note && <span className="text-muted-foreground"> ({r.note})</span>}
                </span>
                <span className="shrink-0 text-muted-foreground">{tokens(r.perHour)}/h</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="max-h-[62vh] overflow-hidden md:max-h-[80vh]">
          <ElinorChat className="origin-top md:scale-[0.92]" />
        </div>
      </div>
    ),
  },
  {
    title: "Become a member",
    render: () => (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h2 className="text-[clamp(40px,7vw,110px)] font-extrabold leading-[0.95] text-foreground">
          Make the Commons Hub <span className="text-primary">your home</span>
        </h2>
        <p className="mt-6 text-[clamp(18px,2.4vw,34px)] text-muted-foreground">commonshub.brussels/apply</p>
        <p className="mt-2 text-[clamp(14px,1.6vw,22px)] text-muted-foreground">More about the token: commonshub.brussels/token</p>
      </div>
    ),
  },
]

/**
 * /token/slides: the token's story as a deck. Arrow keys, space, a click
 * on either half or a swipe move between slides; F for full screen. The
 * slide number stays in the URL hash (#3), so a link opens on that slide.
 */
export function TokenSlides() {
  const [i, setI] = useState(0)
  const touch = useRef<number | null>(null)
  const go = useCallback((n: number) => setI((cur) => Math.max(0, Math.min(SLIDES.length - 1, typeof n === "number" ? n : cur))), [])

  useEffect(() => {
    const read = () => {
      const n = Number(window.location.hash.slice(1))
      if (n >= 1 && n <= SLIDES.length) setI(n - 1)
    }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])
  const first = useRef(true)
  useEffect(() => {
    // Not on the first render: it would overwrite the slide the link asked for.
    if (first.current) return void (first.current = false)
    history.replaceState(null, "", `#${i + 1}`)
  }, [i])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) (e.preventDefault(), go(i + 1))
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) (e.preventDefault(), go(i - 1))
      else if (e.key === "Home") go(0)
      else if (e.key === "End") go(SLIDES.length - 1)
      else if (e.key === "f") document.documentElement.requestFullscreen?.().catch(() => {})
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [i, go])

  return (
    <div
      className="fixed inset-0 flex select-none flex-col bg-background"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return
        const dx = e.changedTouches[0].clientX - touch.current
        if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1)
        touch.current = null
      }}
    >
      <main className="relative min-h-0 flex-1 overflow-hidden px-[5vw] pb-[3vh] pt-[5vh]" aria-live="polite" aria-label={`Slide ${i + 1} of ${SLIDES.length}: ${SLIDES[i].title}`}>
        {SLIDES[i].render()}
      </main>
      <footer className="flex items-center justify-between gap-3 px-[5vw] pb-4 text-sm text-muted-foreground">
        <Link href="/token" className="inline-flex items-center gap-1 hover:text-foreground" aria-label="Close the slides">
          <X className="h-4 w-4" /> <span className="hidden sm:inline">commonshub.brussels/token</span>
        </Link>
        <div className="flex flex-1 justify-center gap-1.5" aria-hidden>
          {SLIDES.map((s, n) => (
            <button key={s.title} type="button" tabIndex={-1} onClick={() => go(n)} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-primary" : "w-1.5 bg-border"}`} />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="rounded-full p-2 hover:bg-muted disabled:opacity-30" aria-label="Previous slide">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="tabular-nums">
            {i + 1}/{SLIDES.length}
          </span>
          <button type="button" onClick={() => go(i + 1)} disabled={i === SLIDES.length - 1} className="rounded-full p-2 hover:bg-muted disabled:opacity-30" aria-label="Next slide">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="hidden rounded-full p-2 hover:bg-muted sm:inline-flex" aria-label="Full screen">
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  )
}
