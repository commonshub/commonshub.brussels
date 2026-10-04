import type { Metadata } from "next"
import type React from "react"

import { PosterLogo } from "@/components/poster/poster"
import { ScreenRefresh } from "@/components/screen/screen-live"
import { CloudImage } from "@/components/screen/cloud-image"
import { loadMembersScreen, membersCloud } from "@/lib/members-screen"

// Reads the dataset volume at request time.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Our community | Commons Hub Brussels",
  description: "The Commons Hub Brussels logo surrounded by its partner organisations and members, for the big screen.",
  robots: { index: false },
}

/** Screen units: 1% of the width of a 16:9 screen (see components/screen/screen.tsx). */
const s = (n: number) => `calc(var(--s) * ${n})`

/**
 * For the hub's big screen: the round logo in the middle, and a cloud of the
 * partner organisations' logos and the members' avatars around it, gently
 * floating. Public data only (see lib/members-screen.ts).
 */
export default function MembersScreenPage() {
  const { items, members, partners } = loadMembersScreen()
  const positions = membersCloud(partners, members)

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#111] text-white"
      style={{ ["--s" as string]: "min(1vw, calc(100vh / 56.25))" } as React.CSSProperties}
    >
      <style>{`
        html, body { overflow: hidden; background: #111; }
        @keyframes cloud-float { 0%, 100% { transform: translate(-50%, -50%) translateY(0); } 50% { transform: translate(-50%, -50%) translateY(calc(var(--s) * -0.45)); } }
        .cloud-item { position: absolute; transform: translate(-50%, -50%); animation: cloud-float 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cloud-item { animation: none; } }
      `}</style>
      <ScreenRefresh minutes={30} />

      {items.map((item, i) => {
        const { x, y } = positions[i]
        const partner = item.kind === "partner"
        const size = partner ? 5.4 : 3.15
        return (
          <div
            key={item.id}
            className="cloud-item"
            style={{ left: `${x}%`, top: `${y}%`, width: s(size), height: s(size), animationDelay: `${-((i * 0.83) % 7)}s` }}
            title={item.name}
          >
            {partner ? (
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white" style={{ padding: s(0.7) }}>
                <CloudImage src={item.image} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <CloudImage
                src={`${item.image}${item.image.includes("?") ? "&" : "?"}size=128`}
                className="h-full w-full rounded-full object-cover"
                style={{ boxShadow: `0 0 0 ${s(0.18)} rgba(255,255,255,0.25)` }}
              />
            )}
          </div>
        )
      })}

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <div style={{ width: s(17), height: s(17), filter: "drop-shadow(0 0 3vw rgba(255,76,2,0.35))" }}>
          <PosterLogo className="block h-full w-full" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0" style={{ padding: `${s(1.4)} ${s(1.8)}`, fontSize: s(1.15), lineHeight: 1.35, color: "rgba(255,255,255,0.72)" }}>
        <div className="text-white" style={{ fontWeight: 600 }}>{members} members</div>
        <div>{partners} partner organisations</div>
      </div>
      <div className="absolute bottom-0 right-0 text-right" style={{ padding: `${s(1.4)} ${s(1.8)}`, fontSize: s(1.15), lineHeight: 1.35, color: "rgba(255,255,255,0.72)" }}>
        <div>Become a member</div>
        <div className="text-white" style={{ fontWeight: 600 }}>commonshub.brussels/membership</div>
      </div>
    </div>
  )
}
