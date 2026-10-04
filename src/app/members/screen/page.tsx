import type { Metadata } from "next";
import QRCode from "qrcode";
import type React from "react";

import { PosterLogo } from "@/components/poster/poster";
import { ScreenClock, ScreenRefresh } from "@/components/screen/screen-live";
import { ScreenQr } from "@/components/screen/screen-qr";
import { CloudImage } from "@/components/screen/cloud-image";
import { loadMembersScreen, membersCloud } from "@/lib/members-screen";

// Reads the dataset volume at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our community | Commons Hub Brussels",
  description:
    "The Commons Hub Brussels logo surrounded by its partner organisations and members, for the big screen.",
  robots: { index: false },
};

/** Screen units: 1% of the width of a 16:9 screen (see components/screen/screen.tsx). */
const s = (n: number) => `calc(var(--s) * ${n})`;

/**
 * For the hub's big screen: the round logo in the middle, and a cloud of the
 * partner organisations' logos and the members' avatars around it, gently
 * floating. Public data only (see lib/members-screen.ts).
 */
/** Always the public address, whichever copy of the site is on the screen. */
const JOIN_URL = "https://commonshub.brussels/membership";

/**
 * The heartbeat: the logo beats (lub-dub) every BEAT seconds and sends out a
 * ripple that grows from the logo's edge to past the corners of the screen,
 * at a steady speed; each partner and member pulses as the ripple reaches it.
 */
const BEAT = 2.4;
const LOGO = 17; // diameter, in screen units
const RIPPLE_SCALE = 7; // the ripple ends 7× the logo's size, past the corners
/** When the ripple reaches a point (screen percentages), in seconds after the beat. */
function rippleDelay(x: number, y: number): number {
  const d = Math.hypot(x - 50, (y - 50) * 0.5625); // in screen units: the screen is 100 × 56.25
  const r0 = LOGO / 2;
  return Math.max(0, ((d - r0) / (r0 * (RIPPLE_SCALE - 1))) * BEAT);
}

export default async function MembersScreenPage() {
  const qrSvg = await QRCode.toString(JOIN_URL, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
  });
  const { items, members, partners } = loadMembersScreen();
  const positions = membersCloud(partners, members);

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-[#111] text-white"
      style={
        {
          ["--s" as string]: "min(1vw, calc(100vh / 56.25))",
        } as React.CSSProperties
      }
    >
      <style>{`
        html, body { overflow: hidden; background: #111; }
        @keyframes cloud-float { 0%, 100% { transform: translate(-50%, -50%) translateY(0); } 50% { transform: translate(-50%, -50%) translateY(calc(var(--s) * -0.45)); } }
        .cloud-item { position: absolute; transform: translate(-50%, -50%); animation: cloud-float 7s ease-in-out infinite; }
        @keyframes heart-beat { 0% { transform: scale(1); } 7% { transform: scale(1.07); } 15% { transform: scale(0.99); } 23% { transform: scale(1.045); } 36%, 100% { transform: scale(1); } }
        .heart { animation: heart-beat ${BEAT}s ease-in-out infinite; }
        @keyframes heart-ripple { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; } 100% { transform: translate(-50%, -50%) scale(${RIPPLE_SCALE}); opacity: 0; } }
        .ripple { position: absolute; left: 50%; top: 50%; width: calc(var(--s) * ${LOGO}); height: calc(var(--s) * ${LOGO}); border-radius: 9999px; border: calc(var(--s) * 0.25) solid rgba(255, 76, 2, 0.7); animation: heart-ripple ${BEAT}s linear infinite; pointer-events: none; }
        @keyframes cloud-pulse { 0% { transform: scale(1); filter: brightness(1); } 8% { transform: scale(1.14); filter: brightness(1.25); } 22%, 100% { transform: scale(1); filter: brightness(1); } }
        .cloud-pulse { width: 100%; height: 100%; animation: cloud-pulse ${BEAT}s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cloud-item, .heart, .ripple, .cloud-pulse { animation: none; } .ripple { display: none; } }
      `}</style>
      <ScreenRefresh minutes={10} />

      <div className="ripple" aria-hidden="true" />

      {items.map((item, i) => {
        const { x, y } = positions[i];
        const partner = item.kind === "partner";
        const size = partner ? 5.4 : 3.15;
        return (
          <div
            key={item.id}
            className="cloud-item"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: s(size),
              height: s(size),
              animationDelay: `${-((i * 0.83) % 7)}s`,
            }}
            title={item.name}
          >
            <div
              className="cloud-pulse"
              style={{ animationDelay: `${rippleDelay(x, y).toFixed(2)}s` }}
            >
              {partner ? (
                <div
                  className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white"
                  style={{ padding: s(0.7) }}
                >
                  <CloudImage
                    src={item.image}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <CloudImage
                  src={`${item.image}${item.image.includes("?") ? "&" : "?"}size=128`}
                  className="h-full w-full rounded-full object-cover"
                  style={{
                    boxShadow: `0 0 0 ${s(0.18)} rgba(255,255,255,0.25)`,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <div
          className="heart"
          style={{
            width: s(LOGO),
            height: s(LOGO),
            filter: "drop-shadow(0 0 3vw rgba(255,76,2,0.35))",
          }}
        >
          <PosterLogo className="block h-full w-full" />
        </div>
      </div>

      <div
        className="absolute right-0 top-0"
        style={{
          padding: `${s(2)} ${s(2.6)}`,
          fontSize: s(2.6),
          fontWeight: 600,
          color: "rgba(255,255,255,0.68)",
        }}
      >
        <ScreenClock />
      </div>
      <div
        className="absolute bottom-0 left-0"
        style={{
          padding: `${s(1.4)} ${s(1.8)}`,
          fontSize: s(1.15),
          lineHeight: 1.35,
          color: "rgba(255,255,255,0.72)",
        }}
      >
        <div className="text-white" style={{ fontWeight: 600 }}>
          {members} members
        </div>
        <div>{partners} partner organisations</div>
      </div>
      <div
        className="absolute bottom-0 right-0"
        style={{ padding: `${s(1.4)} ${s(1.8)}` }}
      >
        <ScreenQr qrSvg={qrSvg} cta="Become a member" url={JOIN_URL} />
      </div>
    </div>
  );
}
