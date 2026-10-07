import { Caveat } from "next/font/google"
import type React from "react"

import type { Contribution, Praise } from "@/lib/contributions-screen"
import { RelativeTime } from "./relative-time"
import { MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /contributions/screen/2: a wall of thank-yous. Each one posted in 💝praise
 * is a sticky note ("To Leen, for figuring out the door! — Marijke"), each
 * contribution from #contributions a polaroid (its photo, or an emoji for
 * what was done). Notes drop onto the wall one after the other, each with
 * a small "2 days ago". No blurred shadows and nothing looping: the Samsung TV's
 * browser crashed on this page.
 */

const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"] })

const NOTE_COLORS = ["#ffe27a", "#ffb3c7", "#bfe8b0", "#b9dcff", "#ffc69a", "#e2c8ff"]

/** Where the notes and polaroids go, in % of the wall (left, top, width), and their tilt. */
const NOTE_SLOTS = [
  { left: 0.5, top: 3, width: 20, tilt: -3 },
  { left: 21.5, top: 7, width: 20, tilt: 2.5 },
  { left: 43, top: 1, width: 21, tilt: -1.5 },
  { left: 2, top: 52, width: 20, tilt: 1.5 },
  { left: 23.5, top: 56, width: 20, tilt: -2 },
  { left: 45, top: 50, width: 19, tilt: 2 },
]
const POLAROID_SLOTS = [
  { left: 68, top: 0, width: 15, tilt: 3 },
  { left: 84, top: 6, width: 14, tilt: -2.5 },
  { left: 67, top: 47, width: 14, tilt: -4 },
]

function addressee(to: Praise["to"]): string {
  if (to.length > 3) return `To ${to.length} people 💖`
  const names = to.map((t) => t.name)
  return `To ${names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0]},`
}

function Note({ praise, slot, color, order }: { praise: Praise; slot: (typeof NOTE_SLOTS)[number]; color: string; order: number }) {
  const long = praise.text.length
  const size = long > 120 ? 1.55 : long > 70 ? 1.8 : 2.1
  return (
    <div
      className="absolute"
      style={
        {
          left: `${slot.left}%`,
          top: `${slot.top}%`,
          width: `${slot.width}%`,
          ["--tilt" as string]: `${slot.tilt}deg`,
          transform: `rotate(${slot.tilt}deg)`,
          animation: `wall-drop 700ms cubic-bezier(.2,.9,.3,1.3) ${order * 0.45}s both`,
        } as React.CSSProperties
      }
    >
      <div
        className={`relative ${hand.className}`}
        style={{
          background: color,
          color: "#2b2118",
          padding: `${s(1.3)} ${s(1.3)} ${s(1)}`,
          boxShadow: "0 6px 0 rgba(0,0,0,.35)",
        }}
      >
        <span className="absolute left-1/2 -translate-x-1/2" style={{ top: s(-0.6), width: s(5.5), height: s(1.3), background: "rgba(255,255,255,0.35)", transform: "translateX(-50%) rotate(-3deg)" }} />
        <div style={{ fontSize: s(1.55), fontWeight: 700, lineHeight: 1.1 }}>{addressee(praise.to)}</div>
        <div className="line-clamp-4" style={{ fontSize: s(size), lineHeight: 1.05, marginTop: s(0.3) }}>
          {praise.text}
        </div>
        <div className="flex items-baseline justify-between" style={{ gap: s(0.6), marginTop: s(0.6) }}>
          <span className="whitespace-nowrap font-sans" style={{ fontSize: s(0.85), opacity: 0.5 }}>
            <RelativeTime ms={praise.at} />
          </span>
          <span className="truncate" style={{ fontSize: s(1.35), opacity: 0.75 }}>
            — {praise.from.name}
          </span>
        </div>
      </div>
    </div>
  )
}

function Polaroid({ item, slot, order }: { item: Contribution; slot: (typeof POLAROID_SLOTS)[number]; order: number }) {
  return (
    <div
      className="absolute"
      style={
        {
          left: `${slot.left}%`,
          top: `${slot.top}%`,
          width: `${slot.width}%`,
          ["--tilt" as string]: `${slot.tilt}deg`,
          transform: `rotate(${slot.tilt}deg)`,
          animation: `wall-drop 700ms cubic-bezier(.2,.9,.3,1.3) ${order * 0.45}s both`,
        } as React.CSSProperties
      }
    >
      <div className={hand.className} style={{ background: "#f6f1ea", color: "#2b2118", padding: `${s(0.8)} ${s(0.8)} ${s(0.9)}`, boxShadow: "0 6px 0 rgba(0,0,0,.35)" }}>
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="block w-full object-cover" style={{ aspectRatio: "1" }} />
        ) : (
          <div className="grid w-full place-items-center" style={{ aspectRatio: "1", background: "#e9dfd2", fontSize: s(6) }}>
            {item.emoji}
          </div>
        )}
        {item.text && (
          <div className="line-clamp-2" style={{ fontSize: s(1.55), lineHeight: 1.05, marginTop: s(0.6) }}>
            {item.text}
          </div>
        )}
        <div style={{ fontSize: s(1.2), opacity: 0.7, marginTop: s(0.25) }}>
          {item.author.name} · <RelativeTime ms={item.at} />
        </div>
      </div>
    </div>
  )
}

export function ThankYouWall({ praises, contributions, qrSvg, url, cta, label }: { praises: Praise[]; contributions: Contribution[]; qrSvg: string; url: string; cta: string; label?: string }) {
  const notes = praises.slice(0, NOTE_SLOTS.length)
  // Photos first: they make the wall; then words, newest first.
  const polaroids = [...contributions.filter((c) => c.image), ...contributions.filter((c) => !c.image && c.text)].slice(0, POLAROID_SLOTS.length)
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: s(1) }}>
      <style>{`
        @keyframes wall-drop { from { opacity: 0; transform: translateY(${s(-3)}) rotate(calc(var(--tilt) * -2)) scale(1.08) } to { opacity: 1; transform: rotate(var(--tilt)) } }
      `}</style>
      <div className="relative min-h-0 flex-1">
        {notes.length === 0 && polaroids.length === 0 && (
          <p style={{ fontSize: s(1.8), color: MUTED }}>The wall is empty for now. Thank someone in 💝praise and it shows up here.</p>
        )}
        {notes.map((p, i) => (
          <Note key={p.id} praise={p} slot={NOTE_SLOTS[i]} color={NOTE_COLORS[i % NOTE_COLORS.length]} order={i} />
        ))}
        {polaroids.map((c, i) => (
          <Polaroid key={c.id} item={c} slot={POLAROID_SLOTS[i]} order={notes.length + i} />
        ))}
      </div>
      <div className="flex shrink-0 items-end justify-between" style={{ gap: s(2) }}>
        <p style={{ fontSize: s(1.2), color: MUTED }}>
          <b style={{ color: "#fff" }}>Notes</b> are thank-yous from 💝praise · <b style={{ color: "#fff" }}>Photos</b> are contributions from #contributions
        </p>
        <ScreenQr qrSvg={qrSvg} cta={cta} url={url} label={label} />
      </div>
    </div>
  )
}
