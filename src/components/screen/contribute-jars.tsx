import type React from "react"

import { COST_COLORS_DARK, slotsFor } from "@/components/contribute/fixed-costs-chart"
import type { RecentContributor } from "@/lib/contribute-screen"
import type { CostLayer, HourLayer, Income, JarsData, TxLine } from "@/lib/contribute-jars"
import { RelativeTime } from "./relative-time"
import { ACCENT, MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /contribute/screen: two jars keep the hub open. Money fills a jar made of
 * the month's costs (cheapest at the bottom, rent on top); time fills the
 * other with the hours given, by kind. In between, the hub's latest money in
 * and out (rent paid as much as a membership), each tagged with its category,
 * and the latest tokens issued: the amount first, on one line, then what
 * for, then when.
 * The newest of each hangs above its jar and drops in; the liquid rises when
 * the slide comes up. Nothing loops: the TV's browser is an old Chromium.
 */

const TIME = "#5fb3f0"
const MONEY_LIGHT = "#ff7a3d"

/** The jar: a neck, shoulders, a straight body (y 170 → 640 is the scale) and a rounded bottom. */
const JAR = "M90 0 H290 V36 Q290 58 330 76 Q380 98 380 150 V590 Q380 640 330 640 H50 Q0 640 0 590 V150 Q0 98 50 76 Q90 58 90 36 Z"
const TOP = 170
const BOTTOM = 640
const SCALE = BOTTOM - TOP
const yAt = (fraction: number) => BOTTOM - Math.min(1, Math.max(0, fraction)) * SCALE

const eur = (n: number) => `€${Math.round(n).toLocaleString("en-GB")}`
const hrs = (n: number) => `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })} h`

/** Shades from light (the bottom layer) to the accent (the top one). */
function shade(from: [number, number, number], to: [number, number, number], i: number, n: number) {
  const t = n <= 1 ? 1 : i / (n - 1)
  const c = from.map((f, k) => Math.round(f + (to[k] - f) * t))
  return `rgb(${c.join(",")})`
}

/** A gentle wave along the liquid's surface, exactly the jar's width. */
const wave = (y: number) => `M0 ${y} q47.5 -12 95 0 t95 0 t95 0 t95 0 V${y + 14} H0 Z`

/**
 * The jar's glass and what is inside it. No clip-path: the TV's browser
 * (Samsung Tizen) ignores it, so the liquid would spill out. Instead the
 * inside is drawn in a nested <svg> the jar's size (which every browser
 * clips to its box), and the corners outside the jar's shape are painted
 * over in the page's colour (an even-odd path: the box minus the jar).
 */
function Glass({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="0.85" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <svg x="0" y="0" width="380" height="640" viewBox="0 0 380 640" overflow="hidden">
        <rect x="0" y="0" width="380" height="640" fill="#1a1a1e" />
        {children}
        <rect x="0" y="0" width="380" height="640" fill={`url(#${id}-glass)`} />
      </svg>
      <path d={`M-12 -12 H392 V652 H-12 Z ${JAR}`} fillRule="evenodd" fill="#111" />
      <path d={JAR} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="5" />
      <rect x="78" y="-22" width="224" height="24" rx="8" fill="#3a3a42" />
      <path d="M28 180 V560" stroke="#fff" strokeOpacity="0.22" strokeWidth="10" strokeLinecap="round" />
    </>
  )
}

/** The liquid rises from the bottom when the slide shows. */
const rise: React.CSSProperties = { transformBox: "view-box", transformOrigin: `0px ${BOTTOM}px`, animation: "jar-rise 1.8s cubic-bezier(.3,.7,.2,1) both" }

/**
 * Where each layer's label goes, from the bottom up: as close to its layer
 * as it can, never on top of the label below. A label is 22 units above its
 * baseline and `below` units under it (more when it has a second line).
 */
function spread(labels: Array<{ center: number; below: number }>, bottom = 660, gap = 10): number[] {
  const out: number[] = []
  let top = bottom
  for (const { center, below } of labels) {
    const y = Math.min(center, top - gap - below)
    out.push(y)
    top = y - 22
  }
  return out
}

/** "Property tax (regional)" reads "Property tax" beside a jar. */
const short = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, "")

function MoneyJar({ layers, total, covered, drop, title, note }: { layers: CostLayer[]; total: number; covered: number; drop: string | null; title: string; note: string }) {
  // Each cost its own colour, the same as on /contribute's breakdown.
  const slots = slotsFor(layers)
  const color = (i: number) => COST_COLORS_DARK[(slots.get(layers[i].slug) ?? 1) - 1] ?? "#888"
  const level = yAt(total > 0 ? covered / total : 0)
  const full = covered >= total && total > 0
  const liquid = BOTTOM - level
  const partly = (l: CostLayer) => l.paid > 0 && l.paid < l.amount
  const labels = spread(layers.map((l) => ({ center: (yAt(l.from) + yAt(l.to)) / 2 + 8, below: partly(l) ? 40 : 6 })))
  const topPaid = layers.reduce((top, l, i) => (l.paid > 0 ? i : top), -1)
  return (
    <svg viewBox="-10 -110 720 860" className="block h-full w-full overflow-visible" preserveAspectRatio="xMinYMid meet" aria-hidden>
      <Drop text={drop} color="#a33200" tilt={-3} />
      <Glass id="money-jar">
        {/* what is still to pay: the ghost of each layer, up to a dashed line at the month's total */}
        {layers.map((l, i) => (
          <rect key={`ghost-${l.slug}`} x="0" y={yAt(l.to)} width="380" height={yAt(l.from) - yAt(l.to)} fill={color(i)} fillOpacity="0.16" />
        ))}
        <line x1="0" x2="380" y1={TOP} y2={TOP} stroke={ACCENT} strokeOpacity="0.55" strokeDasharray="8 8" strokeWidth="2" />
        <g style={rise}>
          {layers.map((l, i) =>
            l.paid > 0 ? <rect key={l.slug} x="0" y={yAt(l.from + (l.paid / l.amount) * (l.to - l.from))} width="380" height={yAt(l.from) - yAt(l.from + (l.paid / l.amount) * (l.to - l.from))} fill={color(i)} /> : null,
          )}

          {covered > 0 && (
            <path d={wave(level)} fill={color(Math.max(0, topPaid))} />
          )}
        </g>
        {/* A clear line between two costs, paid or not. */}
        {layers.slice(0, -1).map((l) => (
          <line key={`sep-${l.slug}`} x1="0" x2="380" y1={yAt(l.to)} y2={yAt(l.to)} stroke="#111" strokeWidth="4" />
        ))}
        {!full && level - TOP >= 90 && (
          <g textAnchor="middle" fill="#fff">
            <text x="190" y={(TOP + level) / 2 - 14} fontSize="22" fillOpacity="0.7" fontWeight="600">
              still to cover
            </text>
            <text x="190" y={(TOP + level) / 2 + 32} fontSize="50" fontWeight="700">
              {eur(total - covered)}
            </text>
          </g>
        )}
        {liquid >= 120 ? (
          <g textAnchor="middle" fill="#fff" style={{ animation: "jar-fade 800ms 1.4s both" }}>
            <text x="190" y={level + liquid / 2 + 8} fontSize="62" fontWeight="700">
              {eur(covered)}
            </text>
            <text x="190" y={level + liquid / 2 + 42} fontSize="22" fontWeight="600" fillOpacity="0.9">
              {full ? "the month is covered!" : `covered · ${Math.floor((covered / total) * 100)}%`}
            </text>
          </g>
        ) : (
          <text x="190" y={level - 24} textAnchor="middle" fill="#fff" fontSize="26" fontWeight="700">
            {eur(covered)} covered
          </text>
        )}
      </Glass>
      <g fontSize="23" fill="#fff" style={{ animation: "jar-fade 800ms 1.2s both" }}>
        {layers.map((l, i) => {
          const center = (yAt(l.from) + yAt(l.to)) / 2
          const y = labels[i]
          const paid = l.paid >= l.amount
          return (
            <g key={`label-${l.slug}`}>
              <path d={`M384 ${center} H402 L420 ${y - 8} H428`} stroke={color(i)} strokeOpacity="0.8" strokeWidth="2" fill="none" />
              <rect x="432" y={y - 18} width="20" height="20" rx="4" fill={color(i)} />
              <text x="462" y={y} fontWeight={paid ? 500 : 700}>
                {paid ? "✓ " : ""}
                {short(l.label)} <tspan fill="rgba(255,255,255,0.65)">{eur(l.amount)}</tspan>
              </text>
              {partly(l) && (
                <text x="462" y={y + 30} fontSize="20" fill="rgba(255,255,255,0.65)">
                  {eur(l.paid)} covered so far
                </text>
              )}
            </g>
          )
        })}
      </g>
      <Caption title={title} note={note} align="start" />
    </svg>
  )
}

function TimeJar({ hours, total, lastMonth, drop, title, note }: { hours: HourLayer[]; total: number; lastMonth: number; drop: string | null; title: string; note: string }) {
  const capacity = Math.max(total, lastMonth, 1) * 1.25
  const n = hours.length
  const color = (i: number) => shade([61, 143, 209], [172, 218, 251], i, n)
  let below = 0
  const bands = hours.map((h, i) => {
    const band = { ...h, y0: yAt(below / capacity), y1: yAt((below + h.hours) / capacity), color: color(i) }
    below += h.hours
    return band
  })
  const level = yAt(total / capacity)
  const last = yAt(lastMonth / capacity)
  return (
    <svg viewBox="-10 -110 400 860" className="block h-full w-full overflow-visible" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <Drop text={drop} color="#1f5f94" tilt={3} />
      <Glass id="time-jar">
        <g style={rise}>
          {bands.map((b) => (
            <rect key={b.kind} x="0" y={b.y1} width="380" height={b.y0 - b.y1} fill={b.color} />
          ))}
          {bands.slice(0, -1).map((b) => (
            <line key={`sep-${b.kind}`} x1="0" x2="380" y1={b.y1} y2={b.y1} stroke="#111" strokeWidth="2" />
          ))}
          {total > 0 && <path d={wave(level)} fill={bands[bands.length - 1].color} />}
        </g>
        {lastMonth > 0 && (
          <g>
            <line x1="0" x2="380" y1={last} y2={last} stroke="#fff" strokeOpacity="0.45" strokeDasharray="6 8" strokeWidth="2" />
            <text x="366" y={last + 26} textAnchor="end" fontSize="18" fill="#fff" fillOpacity="0.6">
              last month · {hrs(lastMonth)}
            </text>
          </g>
        )}
        <g textAnchor="middle" fill="#fff">
          <text x="190" y={Math.min(level, last) - 64} fontSize="62" fontWeight="700">
            {hrs(total)}
          </text>
          <text x="190" y={Math.min(level, last) - 28} fontSize="22" fillOpacity="0.7" fontWeight="600">
            {total > 0 ? "given this month · 1 token = 1 hour" : "take a shift, be the first!"}
          </text>
        </g>
        <g textAnchor="middle" fontSize="23" fontWeight="700" fill="#0d2a44" style={{ animation: "jar-fade 800ms 1.4s both" }}>
          {bands.map((b) =>
            b.y0 - b.y1 >= 30 ? (
              <text key={`label-${b.kind}`} x="190" y={(b.y0 + b.y1) / 2 + 8}>
                {b.emoji} {b.label} · {hrs(b.hours)}
              </text>
            ) : null,
          )}
        </g>
      </Glass>
      <Caption title={title} note={note} />
    </svg>
  )
}

/** The newest item, hanging above the jar's neck, dropping in once. Plain SVG (no foreignObject, for the TV). */
function Drop({ text, color, tilt }: { text: string | null; color: string; tilt: number }) {
  if (!text) return null
  const width = Math.round(text.length * 12.4 + 40)
  return (
    <g transform={`translate(190 -66) rotate(${tilt})`}>
      <g style={{ animation: "jar-drop 1.2s cubic-bezier(.3,1.4,.5,1) 1.6s both" }}>
        <rect x={-width / 2} y="-22" width={width} height="44" rx="22" fill="#fff" />
        <text x="0" y="8" textAnchor="middle" fontSize="23" fontWeight="700" fill={color}>
          {text}
        </text>
      </g>
    </g>
  )
}

/** The jar's name and what fills it, under it. */
function Caption({ title, note, align = "middle" }: { title: string; note: string; align?: "start" | "middle" }) {
  return (
    <g textAnchor={align} fill="#fff">
      <text x={align === "start" ? 0 : 190} y="700" fontSize="32" fontWeight="700">
        {title}
      </text>
      <text x={align === "start" ? 0 : 190} y="734" fontSize="20" fillOpacity="0.62">
        {note}
      </text>
    </g>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap" style={{ padding: `0 ${s(0.5)}`, borderRadius: s(0.45), background: "rgba(255,255,255,0.13)", fontWeight: 600 }}>
      {children}
    </span>
  )
}

const tokens = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "token" : "tokens"}`
const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t)

const IN = "#5ed39a"
const OUT = "#ff8a7a"
const signed = (n: number) => `${n < 0 ? "−" : "+"}€${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** The tag of a transaction's category: green for money in, red for money out, grey when it has none yet. */
function Tag({ tx }: { tx: TxLine }) {
  const color = !tx.slug ? MUTED : tx.amount > 0 ? IN : OUT
  return (
    <span className="inline-block whitespace-nowrap" style={{ padding: `0 ${s(0.5)}`, borderRadius: s(0.45), border: `1px solid ${color}`, color, fontSize: "0.85em", fontWeight: 700, lineHeight: 1.35 }}>
      {tx.tag}
    </span>
  )
}

/** One transaction, on one line: the amount, its tag and what it was, and when. */
function MoneyLine({ tx }: { tx: TxLine }) {
  return (
    <li className="flex items-baseline" style={{ gap: s(1.1), padding: `${s(0.5)} 0`, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <span className="shrink-0 whitespace-nowrap tabular-nums" style={{ width: s(8), fontSize: s(1.45), fontWeight: 700, lineHeight: 1.2, color: tx.amount > 0 ? IN : OUT }}>
        {signed(tx.amount)}
      </span>
      <div className="min-w-0 flex-1" style={{ fontSize: s(1.3), lineHeight: 1.25 }}>
        <div className="truncate">
          <Tag tx={tx} />
          {tx.count && tx.count > 1 && <span style={{ color: MUTED, fontWeight: 700 }}> ×{tx.count}</span>}
          {tx.donation && (
            <>
              {" "}
              {tx.donation.name && <>from <Chip>{tx.donation.name}</Chip> </>}by {tx.donation.via}
            </>
          )}
          {tx.note && <span style={{ color: "rgba(255,255,255,0.8)" }}> {tx.note}</span>}
        </div>
      </div>
      <span className="shrink-0 whitespace-nowrap" style={{ fontSize: s(1), color: MUTED }}>
        <RelativeTime ms={tx.at} />
      </span>
    </li>
  )
}

/** Tokens given for time, on one line: how many, to whom, for what, and when. */
function TimeLine({ award }: { award: RecentContributor }) {
  return (
    <li className="flex items-baseline" style={{ gap: s(1.1), padding: `${s(0.5)} 0`, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <span className="shrink-0 whitespace-nowrap tabular-nums" style={{ width: s(8), fontSize: s(1.45), fontWeight: 700, lineHeight: 1.2, color: TIME }}>
        {tokens(award.tokens ?? 0)}
      </span>
      <div className="min-w-0 flex-1 truncate" style={{ fontSize: s(1.3), lineHeight: 1.25 }}>
        to{" "}
        {award.names.slice(0, 3).map((n) => (
          <span key={n}>
            <Chip>{n}</Chip>{" "}
          </span>
        ))}
        {award.names.length > 3 && <Chip>+{award.names.length - 3}</Chip>}
        {award.reason && <>for {lowerFirst(award.reason)}</>}
      </div>
      <span className="shrink-0 whitespace-nowrap" style={{ fontSize: s(1), color: MUTED }}>
        <RelativeTime ms={award.at} />
      </span>
    </li>
  )
}

const first = (name: string) => name.split(/\s+/)[0]

/** The label hanging above the money jar: the latest money that came in. */
const moneyDrop = (tx: TxLine | undefined) => (tx ? `${signed(tx.amount)} · ${tx.tag.toLowerCase()}` : null)

/** The label hanging above the time jar: the latest tokens. */
const timeDrop = (a: RecentContributor | undefined) => {
  if (!a) return null
  const who = a.names.length > 2 ? `${first(a.names[0])} +${a.names.length - 1}` : a.names.map(first).join(" & ")
  return `${a.reason ? `${a.reason.slice(0, 28)} · ` : `${tokens(a.tokens ?? 0)} · `}${who}`
}

function Heading({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center" style={{ gap: s(0.5), fontSize: s(1.05), letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>
      <i className="inline-block" style={{ width: s(0.6), height: s(0.6), borderRadius: s(0.15), background: color }} />
      {children}
    </div>
  )
}

export function ContributeJars({ data, money, time, qrSvg, url }: { data: JarsData; money: TxLine[]; time: RecentContributor[]; qrSvg: string; url: string }) {
  const newestMoney = moneyDrop(money.find((t) => t.amount > 0 && t.slug))
  const newestTime = timeDrop(time[0])
  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "37% 1fr 21%", gap: s(2) }}>
      <style>{`
        @keyframes jar-rise { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes jar-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes jar-drop { from { opacity: 0; transform: translateY(-48px) } to { opacity: 1; transform: none } }
      `}</style>

      <section className="min-h-0 min-w-0">
        <MoneyJar
          layers={data.layers}
          total={data.total}
          covered={data.covered}
          drop={newestMoney}
          title={`💶 Money · ${data.monthName}`}
          note={data.income.length > 0 ? data.income.map((i: Income) => `${i.label} ${eur(i.amount)}${i.invoiced ? " (invoiced)" : ""}`).join(" · ") : "nothing in yet this month"}
        />
      </section>

      <section className="flex min-h-0 min-w-0 flex-col justify-between" style={{ gap: s(1.2) }}>
        <div className="min-h-0 overflow-hidden">
          <Heading color={MONEY_LIGHT}>Money in and out</Heading>
          <ul style={{ marginTop: s(0.4) }}>
            {money.map((tx) => (
              <MoneyLine key={tx.id} tx={tx} />
            ))}
          </ul>
          {time.length > 0 && (
            <>
              <div style={{ marginTop: s(1) }}>
                <Heading color={TIME}>Time given</Heading>
              </div>
              <ul style={{ marginTop: s(0.4) }}>
                {time.map((a) => (
                  <TimeLine key={`${a.names.join(",")}-${a.at}`} award={a} />
                ))}
              </ul>
            </>
          )}
        </div>
        <ScreenQr qrSvg={qrSvg} cta="Fill a jar" url={url} />
      </section>

      <section className="min-h-0 min-w-0">
        <TimeJar hours={data.hours} total={data.hoursTotal} lastMonth={data.lastMonthHours} drop={newestTime} title={`⏳ Time · ${data.monthName}`} note={data.hours.length > 0 ? data.hours.map((h) => `${h.label} ${hrs(h.hours)}`).join(" · ") : "one token issued = one hour given"} />
      </section>
    </div>
  )
}
