import { Clock, HandCoins } from "lucide-react"
import type React from "react"

import type { ContributeScreenData } from "@/lib/contribute-screen"
import { brusselsDay } from "@/lib/screen"
import { ACCENT, MUTED, s } from "./screen"

function RankedNames({ icon, title, subtitle, names, empty }: { icon: React.ReactNode; title: string; subtitle: string; names: string[]; empty: string }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <h2 className="flex items-center" style={{ gap: s(0.9), fontSize: s(3), fontWeight: 800, lineHeight: 1.1 }}>
        {icon}
        {title}
      </h2>
      <p style={{ fontSize: s(1.35), color: MUTED, marginTop: s(0.3), marginBottom: s(1.2) }}>{subtitle}</p>
      {names.length === 0 ? (
        <p style={{ fontSize: s(1.6), color: MUTED }}>{empty}</p>
      ) : (
        <ol className="flex min-h-0 flex-col" style={{ gap: s(0.45) }}>
          {names.map((name, i) => (
            <li key={`${i}-${name}`} className="flex min-w-0 items-baseline" style={{ gap: s(1), fontSize: s(2), lineHeight: 1.2 }}>
              <span className="shrink-0 text-right tabular-nums" style={{ width: s(2.4), color: ACCENT, fontWeight: 800 }}>
                {i + 1}
              </span>
              <span className="truncate" style={{ fontWeight: i < 3 ? 700 : 500 }}>
                {name}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/**
 * /contribute/screen: why the hub exists, a QR code to /contribute, and who
 * contributes most in money and in time. Names only, in order; no amounts.
 */
export function ContributeBoard({ data, qrSvg, url }: { data: ContributeScreenData; qrSvg: string; url: string }) {
  return (
    <div className="flex min-h-0 flex-1" style={{ gap: s(4) }}>
      <div className="flex shrink-0 flex-col justify-between" style={{ width: s(38) }}>
        <p style={{ fontSize: s(2.35), lineHeight: 1.25, fontWeight: 600, textWrap: "balance" }}>
          The Commons Hub Brussels only exists because of the contributions of the community who invests time and money to give life to this
          space.
        </p>
        <div className="flex flex-col" style={{ gap: s(1.2) }}>
          <div>
            <div style={{ fontSize: s(6), fontWeight: 800, color: ACCENT, lineHeight: 1, letterSpacing: "-0.03em" }}>Contribute!</div>
            <div style={{ fontSize: s(1.8), fontWeight: 600, marginTop: s(0.5) }}>{url.replace(/^https:\/\//, "")}</div>
          </div>
          <div className="rounded-[0.5em] bg-white" style={{ width: s(16), height: s(16), padding: s(0.9) }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: s(3) }}>
          <RankedNames
            icon={<HandCoins style={{ width: s(3), height: s(3), color: ACCENT }} />}
            title="Money"
            subtitle="Lenders, by the size of their loan"
            names={data.lenders}
            empty="See the lenders at commonshub.brussels/debt"
          />
          <RankedNames
            icon={<Clock style={{ width: s(3), height: s(3), color: ACCENT }} />}
            title="Time"
            subtitle="Members, by the tokens they received"
            names={data.contributors}
            empty="No contributions recorded yet"
          />
        </div>
        <p className="shrink-0" style={{ fontSize: s(1.25), color: MUTED, marginTop: s(1) }}>
          {data.donations > 0 && <>And {data.donations.toLocaleString("en-GB")} donations from people and organisations. </>}
          {data.updatedAt && <>Updated {brusselsDay(Date.parse(data.updatedAt))}.</>}
        </p>
      </div>
    </div>
  )
}
