import type { Metadata } from "next"
import QRCode from "qrcode"

import { PosterLogo, posterPrintCss, u } from "@/components/poster/poster"
import { PrintButton } from "@/components/poster/print-button"

export const metadata: Metadata = {
  title: "Membership poster | Commons Hub Brussels",
  description: "Print the A4 poster to become a member of the Commons Hub Brussels: what members can do, the three vouches, prices and a QR code to /apply.",
}

/** Always the public address, whichever copy of the site prints the poster. */
const JOIN_URL = "https://commonshub.brussels/apply"

/**
 * What members can do. The coworking is an extra service, charged separately
 * with VAT: membership doesn't include it (see the fine print).
 */
const POSTER_BENEFITS = [
  "Participate in community events",
  "Join the coworking (charged separately €100/month + VAT)",
  "Book rooms at community price",
  "Take part in the decision making process",
  "Join our Discord to connect with the community",
]

const STEPS = [
  { title: "Apply and meet us", text: "Tell us why you want to join. Come to a potluck or an activity." },
  { title: "Receive three vouches", text: "Three active community members get to know you and vouch for you." },
  { title: "Take part", text: "Join the community and help care for our shared space." },
]

const PLANS = [
  { name: "Individual", price: "€10 · 15 · 20", per: "a month, you choose" },
  { name: "Community", price: "€100", per: "a year" },
  { name: "Organisation", price: "€200", per: "a year" },
]

/** The brand colours, as on our other posters: the orange of the logo and its near-black. */
const ORANGE = "#FF4C02"
const INK = "#001309"

const label = { fontSize: u(4.6), fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" } as const

/**
 * An A4 poster inviting people to become members: what they can do, how
 * membership works (three vouches), what it costs, and a QR code to /apply.
 * Black on white, with "Become a member" in the brand orange.
 */
export default async function MembershipPosterPage() {
  const qr = await QRCode.toString(JOIN_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#000000", light: "#0000" } })

  return (
    <div className="poster-sheet mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <style>{posterPrintCss("A4")}</style>

      <div className="print:hidden flex w-full flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Membership poster</h1>
          <p className="text-sm text-muted-foreground">A4, black on white with an orange headline. Print it, or save it as a PDF from the print dialog.</p>
        </div>
        <PrintButton />
      </div>

      <div className="poster flex flex-col bg-white text-black shadow-sm ring-1 ring-black/10" style={{ width: u(210), height: u(297), padding: u(16) }}>
        <h2 style={{ fontSize: u(16), lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.035em" }}>
          <span style={{ display: "block", color: INK, textWrap: "balance" }}>Make the Commons Hub your home</span>
          <span style={{ display: "block", marginTop: u(1.5), color: ORANGE }}>Become a member</span>
        </h2>
        <div className="flex" style={{ marginTop: u(9), gap: u(10) }}>
          <div className="min-w-0 flex-1">
            <h3 style={label}>As a member, you can</h3>
            <ul style={{ marginTop: u(2), fontSize: u(4.4), lineHeight: 1.35 }}>
              {POSTER_BENEFITS.map((b) => (
                <li key={b} className="flex" style={{ gap: u(2.5), marginTop: u(2.2) }}>
                  <span aria-hidden="true" style={{ fontWeight: 700 }}>✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-col items-center text-center" style={{ width: u(56) }}>
            <div style={{ width: u(52), height: u(52) }} dangerouslySetInnerHTML={{ __html: qr }} />
            <p style={{ marginTop: u(3), fontSize: u(5), fontWeight: 700 }}>Start here</p>
            <p style={{ fontSize: u(3.8) }}>commonshub.brussels/apply</p>
          </div>
        </div>

        <h3 style={{ ...label, marginTop: u(9) }}>Membership grows at the speed of trust</h3>
        <ol className="grid grid-cols-3" style={{ marginTop: u(3), gap: u(5) }}>
          {STEPS.map((step, i) => (
            <li key={step.title} style={{ borderTop: `${u(0.6)} solid #000`, paddingTop: u(2.5) }}>
              <p style={{ fontSize: u(6), fontWeight: 700, lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</p>
              <p style={{ marginTop: u(1.5), fontSize: u(4.2), fontWeight: 700 }}>{step.title}</p>
              <p style={{ marginTop: u(1), fontSize: u(3.6), lineHeight: 1.35 }}>{step.text}</p>
            </li>
          ))}
        </ol>

        <h3 style={{ ...label, marginTop: u(9) }}>What it costs</h3>
        <div className="grid grid-cols-3" style={{ marginTop: u(3), gap: u(4) }}>
          {PLANS.map((p) => (
            <div key={p.name} style={{ border: `${u(0.4)} solid #000`, borderRadius: u(3), padding: u(3.5) }}>
              <p style={{ fontSize: u(4.4), fontWeight: 600 }}>{p.name}</p>
              <p style={{ marginTop: u(1.5), fontSize: u(7), fontWeight: 700, lineHeight: 1.1 }}>{p.price}</p>
              <p style={{ fontSize: u(3.8) }}>{p.per}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: u(3), fontSize: u(3.2), lineHeight: 1.4, color: "#444" }}>
          Your membership fee supports the association and the life of its community: it is not payment for a service. That&apos;s why,
          under Belgian VAT rules, anything you buy as a service (coworking, renting a room, an event ticket) is never included in the
          membership: it is charged separately and invoiced with VAT, at the community price for members.
        </p>

        <div className="mt-auto flex items-center justify-between" style={{ borderTop: `${u(0.3)} solid #000`, paddingTop: u(5), gap: u(6) }}>
          <span className="flex shrink-0 items-center" style={{ gap: u(3) }}>
            <span style={{ width: u(11), height: u(11), display: "block" }}>
              <PosterLogo className="h-full w-full" />
            </span>
            <span style={{ fontSize: u(4.6), fontWeight: 700 }}>commonshub.brussels</span>
          </span>
          <span className="text-right" style={{ fontSize: u(5), fontWeight: 700, lineHeight: 1.25, color: INK }}>
            Join the community and <span style={{ color: ORANGE }}>rediscover the commons</span> with us
          </span>
        </div>
      </div>
    </div>
  )
}
