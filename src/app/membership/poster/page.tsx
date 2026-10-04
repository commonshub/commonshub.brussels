import type { Metadata } from "next"
import QRCode from "qrcode"

import { PosterLogo, posterPrintCss, u } from "@/components/poster/poster"
import { PrintButton } from "@/components/poster/print-button"

export const metadata: Metadata = {
  title: "Membership poster | Commons Hub Brussels",
  description: "Print the A4 poster to become a member of the Commons Hub Brussels: benefits, prices and a QR code.",
}

/** Always the public address, whichever copy of the site prints the poster. */
const JOIN_URL = "https://commonshub.brussels/membership"

/** The individual membership, as offered on /membership (membership-join-section). */
const BENEFITS = [
  "Feel at home: open the door at any time and help yourself in the kitchen",
  "30% off all events and room rentals",
  "Cowork one day a month (or €100/month for unlimited access)",
  "Join our internal economy and decisions: earn tokens for volunteering and use them in the space",
  "Heartbeat meetings every Monday, 13:00–14:00",
  "All the Discord channels: make proposals and co-create the hub",
  "Play the Commons Game and learn Elinor Ostrom's 8 principles",
]

const PLANS = [
  { name: "Individual", price: "from €10", per: "a month", note: "Pay what you can, €10 to €100 a month, or €100 a year." },
  { name: "Community", price: "from €100", per: "a year", note: "Make the hub the place where your community meets." },
  { name: "Organisation", price: "from €200", per: "a year", note: "Two members who can open the door, 30% off, your logo on our website." },
]

/**
 * An A4 poster inviting people to become members: what they get, what it
 * costs, and a QR code to /membership. Black on white to save ink.
 */
export default async function MembershipPosterPage() {
  const qr = await QRCode.toString(JOIN_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#000000", light: "#0000" } })

  return (
    <div className="poster-sheet mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <style>{posterPrintCss("A4")}</style>

      <div className="print:hidden flex w-full flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Membership poster</h1>
          <p className="text-sm text-muted-foreground">A4, black on white to save ink. Print it, or save it as a PDF from the print dialog.</p>
        </div>
        <PrintButton />
      </div>

      <div className="poster flex flex-col bg-white text-black shadow-sm ring-1 ring-black/10" style={{ width: u(210), height: u(297), padding: u(16) }}>
        <div className="flex items-center" style={{ gap: u(3.5) }}>
          <span className="shrink-0" style={{ width: u(11), height: u(11), display: "block" }}>
            <PosterLogo className="h-full w-full" />
          </span>
          <span style={{ fontSize: u(6.5), fontWeight: 600 }}>Commons Hub Brussels</span>
          <span className="ml-auto text-right" style={{ fontSize: u(3.6), lineHeight: 1.3 }}>
            Rue de la Madeleine 51
            <br />
            in front of Brussels Central
          </span>
        </div>

        <h2 style={{ marginTop: u(12), fontSize: u(17), lineHeight: 1.05, fontWeight: 700, letterSpacing: "-0.02em" }}>Become a member</h2>
        <p style={{ marginTop: u(3), fontSize: u(6), lineHeight: 1.3 }}>Make the Commons Hub yours: a common space to meet, dream and work.</p>

        <div className="flex" style={{ marginTop: u(10), gap: u(10) }}>
          <div className="min-w-0 flex-1">
            <h3 style={{ fontSize: u(5), fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>What you get</h3>
            <ul style={{ marginTop: u(3), fontSize: u(4.4), lineHeight: 1.35 }}>
              {BENEFITS.map((b) => (
                <li key={b} className="flex" style={{ gap: u(2.5), marginTop: u(2.2) }}>
                  <span aria-hidden="true" style={{ fontWeight: 700 }}>✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-col items-center text-center" style={{ width: u(62) }}>
            <div style={{ width: u(58), height: u(58) }} dangerouslySetInnerHTML={{ __html: qr }} />
            <p style={{ marginTop: u(3), fontSize: u(5), fontWeight: 700 }}>Scan to join</p>
            <p style={{ fontSize: u(3.8) }}>commonshub.brussels/membership</p>
          </div>
        </div>

        <h3 style={{ marginTop: u(10), fontSize: u(5), fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>What it costs</h3>
        <div className="grid grid-cols-3" style={{ marginTop: u(3), gap: u(4) }}>
          {PLANS.map((p) => (
            <div key={p.name} style={{ border: `${u(0.4)} solid #000`, borderRadius: u(3), padding: u(4) }}>
              <p style={{ fontSize: u(4.4), fontWeight: 600 }}>{p.name}</p>
              <p style={{ marginTop: u(1.5), fontSize: u(7), fontWeight: 700, lineHeight: 1.1 }}>{p.price}</p>
              <p style={{ fontSize: u(3.8) }}>{p.per}</p>
              <p style={{ marginTop: u(2.5), fontSize: u(3.5), lineHeight: 1.35 }}>{p.note}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: u(4), fontSize: u(4), lineHeight: 1.35 }}>
          You can also give time instead of, or as well as, money: from one hour a month, and earn tokens for it.
        </p>

        <div className="mt-auto flex items-end justify-between" style={{ borderTop: `${u(0.3)} solid #000`, paddingTop: u(4), fontSize: u(3.8) }}>
          <span>Questions? hello@commonshub.brussels</span>
          <span style={{ fontWeight: 600 }}>commonshub.brussels/membership</span>
        </div>
      </div>
    </div>
  )
}
