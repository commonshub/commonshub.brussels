"use client"

import { useEffect, useRef, useState } from "react"

import { COST_COLORS_DARK, slotsFor } from "@/components/contribute/fixed-costs-chart"
import type { ScreenCost } from "@/lib/contribute-screen"
import type { DonateToday as Data, Received } from "@/lib/donate-today"
import { ACCENT, MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /donate/screen: today's money in big, the payments under it as they
 * arrive, and a bar as long as a month of the hub's fixed costs, one segment
 * per cost (cheapest first, as the jar on /contribute/screen fills). Earlier
 * this month fills it in each cost's colour, today in white on top.
 * Polls every 30 seconds; a new payment slides in and the number flashes,
 * once. Nothing loops: the TV's browser is an old Chromium.
 */

const POLL_MS = 30_000

const eur = (n: number) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`
const time = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" })

const KIND: Record<Received["kind"], { emoji: string; label: string }> = {
  donation: { emoji: "💝", label: "Donation" },
  membership: { emoji: "🤝", label: "Membership" },
  payment: { emoji: "💶", label: "Payment" },
}

const key = (r: Received) => `${r.via}-${r.at}-${r.amount}`

export function DonateToday({ initial, costs, qrSvg, url }: { initial: Data; costs: ScreenCost[]; qrSvg: string; url: string }) {
  const [data, setData] = useState(initial)
  const seen = useRef(new Set(initial.today.map(key)))
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/donate/today", { cache: "no-store" })
        if (!res.ok) return
        const next = (await res.json()) as Data
        const added = next.today.map(key).filter((k) => !seen.current.has(k))
        added.forEach((k) => seen.current.add(k))
        if (added.length > 0) {
          setFresh(new Set(added))
          setFlash((n) => n + 1)
        }
        setData(next)
      } catch {}
    }, POLL_MS)
    return () => clearInterval(id)
  }, [])

  const goal = costs.reduce((sum, c) => sum + c.amount, 0)
  const ordered = [...costs].sort((a, b) => a.amount - b.amount)
  const slots = slotsFor(costs)
  const colour = (slug: string) => COST_COLORS_DARK[(slots.get(slug) ?? 1) - 1]
  const covered = data.monthBefore + data.todayTotal
  const pct = (n: number) => (goal > 0 ? Math.min(100, (n / goal) * 100) : 0)
  const beforePct = pct(data.monthBefore)
  const todayPct = Math.min(100 - beforePct, pct(data.todayTotal))
  const count = data.today.length

  // Where each cost starts on the bar.
  let below = 0
  const segments = ordered.map((c) => {
    const seg = { ...c, from: below, paid: Math.max(0, Math.min(c.amount, covered - below)) }
    below += c.amount
    return seg
  })
  const track = (opacity: number) =>
    segments.map((c, i) => (
      <div
        key={c.slug}
        className="absolute inset-y-0"
        style={{ left: `${pct(c.from)}%`, width: `calc(${pct(c.amount)}% - ${i < segments.length - 1 ? "3px" : "0px"})`, background: colour(c.slug), opacity }}
      />
    ))

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: s(2) }}>
      <style>{`
        @keyframes dt-in { from { opacity: 0; transform: translateY(-40%); } to { opacity: 1; transform: none; } }
        @keyframes dt-flash { 0% { color: #fff; transform: scale(1.06); } 100% { color: ${ACCENT}; transform: none; } }
        .dt-in { animation: dt-in 0.8s ease-out both; }
        .dt-flash { animation: dt-flash 1.6s ease-out both; transform-origin: left center; }
      `}</style>

      <div className="flex min-h-0 flex-1" style={{ gap: s(3) }}>
        {/* Today, in big */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div key={flash} className={flash ? "dt-flash" : ""} style={{ fontSize: s(13), fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.04em", color: ACCENT }}>
            {eur(data.todayTotal)}
          </div>
          <div style={{ fontSize: s(2.4), marginTop: s(1), fontWeight: 600 }}>
            raised today{count > 0 && <span style={{ color: MUTED, fontWeight: 500 }}> · {count === 1 ? "1 payment" : `${count} payments`}</span>}
          </div>
          <div style={{ fontSize: s(1.7), marginTop: s(0.6), color: MUTED }}>
            {eur(Math.round(covered * 100) / 100)} this month, of the {eur(goal)} the hub needs
          </div>
        </div>

        {/* Today's payments */}
        <div className="flex min-h-0 shrink-0 flex-col" style={{ width: s(42) }}>
          <div style={{ fontSize: s(1.4), color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Today</div>
          {count === 0 ? (
            <div style={{ fontSize: s(2), marginTop: s(1.2), color: MUTED }}>Nothing yet today. Be the first one ↘</div>
          ) : (
            <ul className="min-h-0 overflow-hidden" style={{ marginTop: s(0.6) }}>
              {data.today.slice(0, 7).map((r) => (
                <li
                  key={key(r)}
                  className={`flex items-baseline ${fresh.has(key(r)) ? "dt-in" : ""}`}
                  style={{ gap: s(1.2), padding: `${s(0.7)} 0`, borderBottom: "1px solid rgba(255,255,255,0.12)", fontSize: s(1.9) }}
                >
                  <span className="tabular-nums" style={{ color: MUTED, width: s(5.5) }}>
                    {time(r.at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {KIND[r.kind].emoji} {KIND[r.kind].label}
                    {r.name && <span style={{ fontWeight: 700 }}> from {r.name}</span>}
                    <span style={{ color: MUTED, fontSize: s(1.5) }}> · {r.via}</span>
                  </span>
                  <span className="tabular-nums" style={{ fontWeight: 700 }}>
                    {eur(r.amount)}
                  </span>
                </li>
              ))}
              {count > 7 && <li style={{ fontSize: s(1.5), color: MUTED, paddingTop: s(0.6) }}>and {count - 7} more</li>}
            </ul>
          )}
        </div>
      </div>

      {/* The month's bar */}
      <div className="shrink-0">
        <div className="relative w-full overflow-hidden rounded-[0.3em]" style={{ height: s(4.2) }} role="img" aria-label={`${eur(covered)} of ${eur(goal)} this month, ${eur(data.todayTotal)} of it today`}>
          {track(0.2)}
          <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${beforePct}%`, transition: "width 1.2s ease-out" }}>
            <div className="relative h-full" style={{ width: beforePct > 0 ? `${(100 / beforePct) * 100}%` : "0" }}>
              {track(1)}
            </div>
          </div>
          {data.todayTotal > 0 && (
            <div
              className="absolute inset-y-0"
              style={{ left: `${beforePct}%`, width: `${todayPct}%`, minWidth: s(0.6), background: "#fff", boxShadow: `0 0 ${s(1.2)} ${ACCENT}`, transition: "width 1.2s ease-out" }}
            />
          )}
        </div>
        <div className="flex justify-between" style={{ fontSize: s(1.4), color: MUTED, marginTop: s(0.5) }}>
          <span>
            <span style={{ display: "inline-block", width: s(1.1), height: s(1.1), background: "#fff", borderRadius: "0.15em", marginRight: s(0.4), verticalAlign: "-0.1em" }} />
            today · coloured: earlier this month
          </span>
          <span>{covered >= goal ? "🎉 This month's costs are covered" : `${Math.round(pct(covered))}% of the month`}</span>
        </div>
      </div>

      {/* What a month costs, and the call to action */}
      <div className="flex shrink-0 items-end" style={{ gap: s(3) }}>
        <ul className="flex min-w-0 flex-1 flex-wrap" style={{ columnGap: s(2.4), rowGap: s(0.8), fontSize: s(1.6) }}>
          {segments.map((c) => (
            <li key={c.slug} className="flex items-center whitespace-nowrap" style={{ gap: s(0.6) }}>
              <span className="shrink-0" style={{ width: s(1.2), height: s(1.2), borderRadius: "0.2em", background: colour(c.slug) }} />
              <span>{c.label}</span>
              <span className="shrink-0 tabular-nums" style={{ color: MUTED }}>
                {eur(c.amount)}
              </span>
              {c.paid >= c.amount && <span className="shrink-0">✓</span>}
            </li>
          ))}
        </ul>
        <ScreenQr qrSvg={qrSvg} cta="Chip in" url={url} />
      </div>
    </div>
  )
}
