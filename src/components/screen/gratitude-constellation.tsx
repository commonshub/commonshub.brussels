"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"

import type { GraphEdge, GraphNode, Praise } from "@/lib/contributions-screen"
import { RelativeTime } from "./relative-time"
import { ACCENT, MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /contributions/screen/1: who thanked whom. Everyone thanked or thanking in
 * 💝praise lately is a dot, every thank-you a line from giver to receiver
 * (older lines fainter). The latest thank-yous take turns: their lines light
 * up, a heart travels from the giver to the receiver and the words show
 * underneath. On the right, the latest thank-yous, the one on show
 * highlighted. Which one comes next is picked at random, so a screen that
 * reloads doesn't always start with the same.
 */

const TURN_MS = 6500

/** The control point of the curve between two dots: bowed to one side, the same way every time. */
function control(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  return { x: mx - (b.y - a.y) * 0.25, y: my + (b.x - a.x) * 0.25 }
}

function Avatar({ node, size, lit, receiving }: { node: GraphNode; size: string; lit: boolean; receiving: boolean }) {
  return (
    <span
      className="relative block overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: receiving ? ACCENT : "#2a2a30",
        boxShadow: lit ? `0 0 0 ${s(0.25)} ${ACCENT}, 0 0 ${s(1.6)} ${ACCENT}` : `0 0 0 ${s(0.1)} rgba(255,255,255,0.25)`,
        transition: "box-shadow 600ms, background 600ms",
        animation: receiving ? "gc-pulse 1.4s ease-out 1.2s" : undefined,
      }}
    >
      {node.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={node.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center" style={{ fontWeight: 700, fontSize: `calc(${size} * 0.42)` }}>
          {node.name[0]?.toUpperCase()}
        </span>
      )}
    </span>
  )
}

/** A heart moving along the curve from giver to receiver, in % of the drawing. */
function TravellingHeart({ from, to }: { from: GraphNode; to: GraphNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const c = control(from, to)
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400)
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * c.x + e * e * to.x
      const y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * c.y + e * e * to.y
      if (ref.current) {
        ref.current.style.left = `${x * 100}%`
        ref.current.style.top = `${y * 100}%`
        ref.current.style.opacity = t < 1 ? "1" : "0"
      }
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [from, to])
  return (
    <span ref={ref} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ fontSize: s(2), opacity: 0, transition: "opacity 300ms" }}>
      💖
    </span>
  )
}

function Graph({ nodes, edges, current }: { nodes: GraphNode[]; edges: GraphEdge[]; current?: Praise }) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const times = edges.map((e) => e.at)
  const oldest = Math.min(...times)
  const newest = Math.max(...times)
  const maxWeight = Math.max(1, ...nodes.map((n) => n.weight))
  const litEdge = (e: GraphEdge) => !!current && e.from === current.from.id && current.to.some((t) => t.id === e.to)
  const receivers = new Set(current?.to.map((t) => t.id))
  const giver = current ? byId.get(current.from.id) : undefined
  const firstReceiver = current?.to.map((t) => byId.get(t.id)).find(Boolean)

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0" style={{ background: `radial-gradient(closest-side, rgba(255,76,2,0.22), transparent)` }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {edges.map((e) => {
          const a = byId.get(e.from)
          const b = byId.get(e.to)
          if (!a || !b) return null
          const c = control(a, b)
          const age = newest > oldest ? (e.at - oldest) / (newest - oldest) : 1
          const lit = litEdge(e)
          return (
            <path
              key={`${e.from}>${e.to}`}
              d={`M${a.x * 100} ${a.y * 100} Q${c.x * 100} ${c.y * 100} ${b.x * 100} ${b.y * 100}`}
              fill="none"
              stroke={ACCENT}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{
                strokeWidth: lit ? 6 : 2.5,
                strokeOpacity: lit ? 1 : 0.15 + 0.4 * age,
                filter: lit ? `drop-shadow(0 0 6px ${ACCENT})` : undefined,
                transition: "stroke-width 600ms, stroke-opacity 600ms",
              }}
            />
          )
        })}
      </svg>
      {nodes.map((n) => {
        const size = s(2.4 + (1.8 * (n.weight - 1)) / Math.max(1, maxWeight - 1))
        const lit = !!current && (n.id === current.from.id || receivers.has(n.id))
        return (
          <div key={n.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%`, gap: s(0.3) }}>
            <Avatar node={n} size={size} lit={lit} receiving={receivers.has(n.id)} />
            <span className="whitespace-nowrap" style={{ fontSize: s(1.05), fontWeight: 600, color: lit ? "#fff" : MUTED, transition: "color 600ms" }}>
              {n.name}
            </span>
          </div>
        )
      })}
      {giver && firstReceiver && <TravellingHeart key={current!.id} from={giver} to={firstReceiver} />}
    </div>
  )
}

const recipients = (to: Praise["to"]) => (to.length > 3 ? [...to.slice(0, 2).map((t) => t.name), `${to.length - 2} others`] : to.map((t) => t.name))

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap" style={{ padding: `0 ${s(0.5)}`, borderRadius: s(0.5), background: "rgba(255,255,255,0.14)", fontWeight: 650, color: "#fff" }}>
      {children}
    </span>
  )
}

function Quote({ praise }: { praise: Praise }) {
  return (
    <div
      className="shrink-0"
      style={{ padding: `${s(1.3)} ${s(1.8)}`, borderRadius: s(1.1), background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", animation: "gc-in 700ms ease-out both" }}
    >
      <div className="line-clamp-2" style={{ fontSize: s(2), lineHeight: 1.25, fontWeight: 600 }}>
        “{praise.text}”
      </div>
      <div className="flex flex-wrap items-baseline" style={{ marginTop: s(0.7), fontSize: s(1.25), color: MUTED, gap: s(0.45) }}>
        <Chip>{praise.from.name}</Chip> thanked
        {recipients(praise.to).map((name, i, all) => (
          <span key={name}>
            <Chip>{name}</Chip>
            {i < all.length - 2 ? "," : i === all.length - 2 ? " and" : ""}
          </span>
        ))}
        <span>
          · <RelativeTime ms={praise.at} />
        </span>
      </div>
    </div>
  )
}

function PraiseList({ items, current }: { items: Praise[]; current?: Praise }) {
  return (
    <section className="flex min-h-0 flex-col">
      <div style={{ fontSize: s(1.1), letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>Latest thank-yous</div>
      <ul className="min-h-0 overflow-hidden" style={{ marginTop: s(0.6) }}>
        {items.map((p) => {
          const on = p.id === current?.id
          return (
            <li
              key={p.id}
              style={{
                padding: `${s(0.6)} ${s(0.8)}`,
                marginTop: s(0.35),
                borderRadius: s(0.7),
                background: on ? "rgba(255,76,2,0.16)" : "transparent",
                boxShadow: on ? `inset ${s(0.25)} 0 0 ${ACCENT}` : "none",
                opacity: on ? 1 : 0.6,
                transition: "background 600ms, opacity 600ms, box-shadow 600ms",
              }}
            >
              <div style={{ fontSize: s(1.05), color: on ? "#fff" : MUTED, fontWeight: 600 }}>
                {p.from.name} → {recipients(p.to).join(", ")} · <RelativeTime ms={p.at} />
              </div>
              <div className="line-clamp-2" style={{ fontSize: s(1.3), lineHeight: 1.25, marginTop: s(0.15) }}>
                {p.text}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function GratitudeConstellation({
  nodes,
  edges,
  praises,
  qrSvg,
  url,
  cta,
  label,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  praises: Praise[]
  qrSvg: string
  url: string
  cta: string
  label?: string
}) {
  // The latest thank-yous take turns in the spotlight, in a random order:
  // a random first one (after hydration), then any other.
  const turns = praises.slice(0, 6)
  const [turn, setTurn] = useState(0)
  useEffect(() => {
    if (turns.length < 2) return
    setTurn(Math.floor(Math.random() * turns.length))
    const id = setInterval(() => setTurn((t) => (t + 1 + Math.floor(Math.random() * (turns.length - 1))) % turns.length), TURN_MS)
    return () => clearInterval(id)
  }, [turns.length])
  const current = turns[turn]

  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "1fr 32%", gap: s(3) }}>
      <style>{`
        @keyframes gc-in { from { opacity: 0; transform: translateY(${s(0.8)}) } to { opacity: 1; transform: none } }
        @keyframes gc-pulse { 0% { transform: scale(1) } 30% { transform: scale(1.18) } 100% { transform: scale(1) } }
      `}</style>
      <div className="flex min-h-0 flex-col" style={{ gap: s(1.2) }}>
        {nodes.length > 0 ? (
          <Graph nodes={nodes} edges={edges} current={current} />
        ) : (
          <p className="flex-1" style={{ fontSize: s(1.6), color: MUTED }}>
            No thank-yous in the last two weeks yet. Be the first!
          </p>
        )}
        {current && <Quote key={current.id} praise={current} />}
      </div>
      <div className="flex min-h-0 flex-col justify-between" style={{ gap: s(1.5) }}>
        <PraiseList items={turns} current={current} />
        <div className="flex justify-end">
          <ScreenQr qrSvg={qrSvg} cta={cta} url={url} label={label} />
        </div>
      </div>
    </div>
  )
}
