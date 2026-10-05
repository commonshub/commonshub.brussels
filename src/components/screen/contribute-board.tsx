import type React from "react"

import { COST_COLORS_DARK, slotsFor } from "@/components/contribute/fixed-costs-chart"
import type { ContributeScreenData, ScreenCost } from "@/lib/contribute-screen"
import { RelativeTime } from "./relative-time"
import { ACCENT, MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /contribute/screen: the two currencies that keep the hub alive, side by
 * side. Yang, money: what a month costs and the latest donations. Yin, time:
 * photos from #contributions and who was thanked for a contribution lately.
 * Every line starts with the amount (euros or tokens), then who (as chips),
 * what for, and how long ago (the date after a week), so the screen shows it
 * is live. Tokens given for the same thing within the hour share a line.
 */
const eur = (n: number) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex items-baseline" style={{ gap: s(1) }}>
      <span style={{ fontSize: s(1.2), fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT }}>{kicker}</span>
      <span style={{ fontSize: s(1.9), fontWeight: 700 }}>{title}</span>
    </div>
  )
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: s(1.6), fontSize: s(1.25), fontWeight: 600, color: MUTED, letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</div>
}

/** What reads well after "for": a lowercase start (unless an acronym or a name), "a 3h shift" rather than "3h shift". */
const forWhat = (reason: string) => {
  const text = /^[A-Z][a-z]/.test(reason) ? reason[0].toLowerCase() + reason.slice(1) : reason
  return /^\d+(?:[.,]\d+)?h\b/.test(text) ? `a ${text}` : text
}

/** A name that stands out: a soft pill. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block whitespace-nowrap align-baseline" style={{ padding: `0 ${s(0.55)}`, borderRadius: s(0.6), background: "rgba(255,255,255,0.12)", fontWeight: 600, lineHeight: 1.3 }}>
      {children}
    </span>
  )
}

/** Up to three people as chips, then "+N". */
function NameChips({ list }: { list: string[] }) {
  const shown = list.slice(0, 3)
  return (
    <span className="inline-flex flex-nowrap items-baseline" style={{ gap: s(0.35) }}>
      {shown.map((n) => (
        <Chip key={n}>{n}</Chip>
      ))}
      {list.length > shown.length && <Chip>+{list.length - shown.length}</Chip>}
    </span>
  )
}

/** One line: the amount first, what it is, and when. */
function Line({ figure, text, at }: { figure?: string; text: React.ReactNode; at: number }) {
  return (
    <li className="flex min-w-0 items-baseline" style={{ gap: s(0.7), marginTop: s(0.4) }}>
      {figure && (
        <span className="shrink-0 tabular-nums" style={{ fontWeight: 700, color: ACCENT }}>
          {figure}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <span className="shrink-0 tabular-nums" style={{ color: MUTED, fontSize: "0.85em" }}>
        <RelativeTime ms={at} />
      </span>
    </li>
  )
}

function Yang({ costs, donations }: { costs: ScreenCost[]; donations: ContributeScreenData["donations"] }) {
  const total = costs.reduce((sum, c) => sum + c.amount, 0)
  const slots = slotsFor(costs)
  const color = (slug: string) => COST_COLORS_DARK[(slots.get(slug) ?? 0) - 1] ?? MUTED
  return (
    <section className="flex min-h-0 min-w-0 flex-col [&>*]:shrink-0">
      <Heading kicker="Yang" title="Money" />
      {costs.length > 0 && (
        <>
          <div className="flex items-baseline" style={{ marginTop: s(1.2), gap: s(1.2) }}>
            <span className="tabular-nums" style={{ fontSize: s(3.6), fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {eur(total)}
            </span>
            <span style={{ fontSize: s(1.4), color: MUTED }}>every month to keep the space open</span>
          </div>
          <div className="flex w-full overflow-hidden" style={{ marginTop: s(1), height: s(1.2), gap: 2, borderRadius: s(0.3) }}>
            {costs.map((c) => (
              <span key={c.slug} style={{ flexGrow: c.amount, flexBasis: 0, minWidth: 3, backgroundColor: color(c.slug) }} />
            ))}
          </div>
          <ul className="grid grid-cols-2" style={{ marginTop: s(0.8), columnGap: s(2.4), fontSize: s(1.3), lineHeight: 1.25 }}>
            {costs.map((c) => (
              <li key={c.slug} className="flex min-w-0 items-center" style={{ gap: s(0.7), marginTop: s(0.4) }}>
                <span className="shrink-0" style={{ width: s(0.85), height: s(0.85), borderRadius: s(0.18), backgroundColor: color(c.slug) }} />
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                <span className="shrink-0 tabular-nums" style={{ fontWeight: 600 }}>
                  {eur(c.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Subheading>Latest donations</Subheading>
      {donations.length > 0 ? (
        <ul style={{ fontSize: s(1.55), lineHeight: 1.25 }}>
          {donations.map((d) => (
            <Line
              key={d.at}
              figure={eur(d.amount)}
              text={
                <>
                  donation {d.name && <>from <Chip>{d.name}</Chip> </>}by {d.via}
                </>
              }
              at={d.at}
            />
          ))}
        </ul>
      ) : (
        <p style={{ marginTop: s(0.5), fontSize: s(1.5), color: MUTED }}>No donations in the last three months yet.</p>
      )}
    </section>
  )
}

const SOURCE_TITLE: Record<ContributeScreenData["contributorsFrom"], string> = {
  tokens: "Latest tokens issued",
  mentions: "Recently thanked for their time",
  posts: "Recently shared a contribution",
}

function Yin({ photos, contributors, contributorsFrom }: Pick<ContributeScreenData, "photos" | "contributors" | "contributorsFrom">) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col [&>*]:shrink-0">
      <Heading kicker="Yin" title="Time" />
      {photos.length > 0 && (
        <div className="grid" style={{ marginTop: s(1.2), gridTemplateColumns: `repeat(${photos.length}, 1fr)`, gap: s(0.9) }}>
          {photos.map((p) => (
            <figure key={p.src} className="relative overflow-hidden" style={{ aspectRatio: "1", borderRadius: s(0.6), background: "#222" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" className="h-full w-full object-cover" />
              <figcaption
                className="absolute inset-x-0 bottom-0"
                style={{ padding: `${s(1.6)} ${s(0.6)} ${s(0.4)}`, fontSize: s(1), lineHeight: 1.25, background: "linear-gradient(transparent, rgba(0,0,0,0.8))" }}
              >
                <div className="truncate" style={{ fontWeight: 600 }}>{p.author}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <Subheading>{SOURCE_TITLE[contributorsFrom]}</Subheading>
      {contributors.length > 0 ? (
        <ul style={{ fontSize: s(1.5), lineHeight: 1.25 }}>
          {contributors.map((c) => (
            <Line
              key={`${c.names.join(",")}-${c.at}`}
              figure={c.tokens ? `${c.tokens.toLocaleString("en-GB")} ${c.tokens === 1 ? "token" : "tokens"}` : undefined}
              text={
                <>
                  {c.tokens ? "to " : ""}
                  <NameChips list={c.names} />
                  {c.reason && <span style={{ color: MUTED }}> for {forWhat(c.reason)}</span>}
                </>
              }
              at={c.at}
            />
          ))}
        </ul>
      ) : (
        <p style={{ marginTop: s(0.5), fontSize: s(1.5), color: MUTED }}>No contributions recorded in the last three months yet.</p>
      )}
    </section>
  )
}

export function ContributeBoard({ data, costs = [], qrSvg, url }: { data: ContributeScreenData; costs?: ScreenCost[]; qrSvg: string; url: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: s(1.6) }}>
      <p className="shrink-0" style={{ fontSize: s(1.9), lineHeight: 1.3, fontWeight: 600, textWrap: "balance" }}>
        The Commons Hub Brussels only exists because of the contributions of the community who invests time and money to give life to this space.
      </p>

      <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden" style={{ gap: s(4) }}>
        <Yang costs={costs} donations={data.donations} />
        <Yin photos={data.photos} contributors={data.contributors} contributorsFrom={data.contributorsFrom} />
      </div>

      <div className="flex shrink-0 items-end justify-between" style={{ gap: s(2) }}>
        <p style={{ fontSize: s(1.3), color: MUTED, maxWidth: s(60) }}>
          Thank you to everyone who gives money and time. Donors are named only if they asked to be.
        </p>
        <ScreenQr qrSvg={qrSvg} cta="Contribute!" url={url} />
      </div>
    </div>
  )
}
