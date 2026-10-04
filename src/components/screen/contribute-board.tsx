import { COST_COLORS_DARK, slotsFor } from "@/components/contribute/fixed-costs-chart"
import type { ContributeScreenData, ScreenCost } from "@/lib/contribute-screen"
import { cloudNames } from "@/lib/contribute-screen"
import { brusselsDay } from "@/lib/screen"
import { ACCENT, MUTED, s } from "./screen"
import { FitBox } from "./fit-box"
import { ScreenQr } from "./screen-qr"

/**
 * /contribute/screen: why the hub exists, the people who give it time and
 * money as one shuffled cloud of names (not a ranking: no order, no numbers,
 * no amounts), what it costs each month to keep the space open (the fixed
 * costs as /contribute breaks them down, in whole euros), and the QR code to
 * /contribute bottom right.
 */
const eur = (n: number) => `€${n.toLocaleString("en-GB")}`

function CostBreakdown({ costs }: { costs: ScreenCost[] }) {
  const total = costs.reduce((sum, c) => sum + c.amount, 0)
  const slots = slotsFor(costs)
  const color = (slug: string) => COST_COLORS_DARK[(slots.get(slug) ?? 0) - 1] ?? MUTED
  return (
    <div className="flex shrink-0 flex-col justify-center" style={{ width: s(31) }}>
      <div style={{ fontSize: s(4.4), fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }} className="tabular-nums">
        {eur(total)}
      </div>
      <div style={{ marginTop: s(0.5), fontSize: s(1.5), color: MUTED }}>every month to keep the space open</div>
      <div className="flex w-full overflow-hidden" style={{ marginTop: s(1.4), height: s(1.6), gap: 2, borderRadius: s(0.4) }}>
        {costs.map((c) => (
          <span key={c.slug} style={{ flexGrow: c.amount, flexBasis: 0, minWidth: 3, backgroundColor: color(c.slug) }} />
        ))}
      </div>
      <ul style={{ marginTop: s(1.4), fontSize: s(1.55), lineHeight: 1.25 }}>
        {costs.map((c) => (
          <li key={c.slug} className="flex items-center" style={{ gap: s(0.9), marginTop: s(0.55) }}>
            <span className="shrink-0" style={{ width: s(1), height: s(1), borderRadius: s(0.2), backgroundColor: color(c.slug) }} />
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            <span className="shrink-0 tabular-nums" style={{ fontWeight: 600 }}>
              {eur(c.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ContributeBoard({
  data,
  costs = [],
  qrSvg,
  url,
  seed,
}: {
  data: ContributeScreenData
  costs?: ScreenCost[]
  qrSvg: string
  url: string
  seed: string
}) {
  // Beside the costs, the cloud has about two thirds of the width; FitBox does the rest.
  const names = cloudNames(data, seed, costs.length > 0 ? 30 : 60)
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: s(1.6) }}>
      <p className="shrink-0" style={{ fontSize: s(2.35), lineHeight: 1.25, fontWeight: 600, maxWidth: s(80), textWrap: "balance" }}>
        The Commons Hub Brussels only exists because of the contributions of the community who invests time and money to give life to this space.
      </p>

      <div className="flex min-h-0 flex-1" style={{ gap: s(4) }}>
        {costs.length > 0 && <CostBreakdown costs={costs} />}
        <FitBox className="flex min-h-0 min-w-0 flex-1 flex-wrap content-center items-baseline justify-center overflow-hidden" style={{ columnGap: s(2.2), rowGap: s(0.6) }}>
          {names.map((n) => (
            <span key={n.name} style={{ fontSize: `calc(var(--s) * ${n.size} * var(--fit, 1))`, fontWeight: n.bold ? 700 : 500, color: n.accent ? ACCENT : "white", lineHeight: 1.15, whiteSpace: "nowrap" }}>
              {n.name}
            </span>
          ))}
        </FitBox>
      </div>

      <div className="flex shrink-0 items-end justify-between" style={{ gap: s(2) }}>
        <p style={{ fontSize: s(1.3), color: MUTED }}>
          Thank you to everyone who lends money and gives time
          {data.donations > 0 && <>, and for {data.donations.toLocaleString("en-GB")} donations from people and organisations</>}.
          {data.updatedAt && <> Updated {brusselsDay(Date.parse(data.updatedAt))}.</>}
        </p>
        <ScreenQr qrSvg={qrSvg} cta="Contribute!" url={url} />
      </div>
    </div>
  )
}
