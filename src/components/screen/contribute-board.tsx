import type { ContributeScreenData } from "@/lib/contribute-screen"
import { cloudNames } from "@/lib/contribute-screen"
import { brusselsDay } from "@/lib/screen"
import { ACCENT, MUTED, s } from "./screen"
import { ScreenQr } from "./screen-qr"

/**
 * /contribute/screen: why the hub exists, the people who give it time and
 * money as one shuffled cloud of names (not a ranking: no order, no numbers,
 * no amounts), and the QR code to /contribute bottom right.
 */
export function ContributeBoard({ data, qrSvg, url, seed }: { data: ContributeScreenData; qrSvg: string; url: string; seed: string }) {
  const names = cloudNames(data, seed)
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ gap: s(1.6) }}>
      <p className="shrink-0" style={{ fontSize: s(2.35), lineHeight: 1.25, fontWeight: 600, maxWidth: s(80), textWrap: "balance" }}>
        The Commons Hub Brussels only exists because of the contributions of the community who invests time and money to give life to this space.
      </p>

      <div className="flex min-h-0 flex-1 flex-wrap content-center items-baseline justify-center overflow-hidden" style={{ columnGap: s(2.2), rowGap: s(0.6) }}>
        {names.map((n) => (
          <span key={n.name} style={{ fontSize: s(n.size), fontWeight: n.size > 2.2 ? 700 : 500, color: n.accent ? ACCENT : "white", lineHeight: 1.15, whiteSpace: "nowrap" }}>
            {n.name}
          </span>
        ))}
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
