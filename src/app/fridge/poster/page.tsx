import type { Metadata } from "next"
import Link from "next/link"
import QRCode from "qrcode"

import { PosterLogo as Logo, posterPrintCss, u } from "@/components/poster/poster"
import { PrintButton } from "@/components/poster/print-button"

export const metadata: Metadata = {
  title: "Fridge poster | Commons Hub Brussels",
  description: "Print the poster for the fridge: scan, record what you take, help keep the fridge full.",
}

/** Always the public address, whichever copy of the site prints the poster. */
const FRIDGE_URL = "https://commonshub.brussels/fridge"

/**
 * A poster to print and stick on the fridge: black on white (no fills, no
 * background), A4 or A5. Sizes are in a unit that is 1mm on an A4 sheet,
 * 1/√2 of it on A5, and shrinks on screen so the preview fits a phone.
 */
export default async function FridgePosterPage({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  const { format } = await searchParams
  const a5 = format?.toLowerCase() === "a5"
  const qr = await QRCode.toString(FRIDGE_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#000000", light: "#0000" } })

  return (
    <div className="poster-sheet mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <style>{posterPrintCss(a5 ? "A5" : "A4")}</style>

      <div className="print:hidden flex w-full flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Fridge poster</h1>
          <p className="text-sm text-muted-foreground">Black on white, to save ink. Print it and stick it on the fridge.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Paper size" className="flex rounded-lg border border-border p-1 text-sm">
            {(["A4", "A5"] as const).map((f) => {
              const active = (f === "A5") === a5
              return (
                <Link
                  key={f}
                  href={f === "A5" ? "/fridge/poster?format=a5" : "/fridge/poster"}
                  role="radio"
                  aria-checked={active}
                  className={`rounded-md px-3 py-1.5 font-medium ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {f}
                </Link>
              )
            })}
          </div>
          <PrintButton />
        </div>
      </div>

      <div
        className="poster flex flex-col items-center bg-white text-black shadow-sm ring-1 ring-black/10"
        style={{ width: u(210), height: u(297), padding: u(18), fontFamily: "inherit" }}
      >
        <div className="flex items-center" style={{ gap: u(4) }}>
          <Logo className="shrink-0" />
          <span style={{ fontSize: u(7), fontWeight: 600, letterSpacing: "-0.01em" }}>Commons Hub Brussels</span>
        </div>
        <style>{`.poster svg[aria-hidden] { width: ${u(12)}; height: ${u(12)}; }`}</style>

        <div className="flex flex-1 flex-col items-center justify-center text-center" style={{ gap: u(9) }}>
          <h2 style={{ fontSize: u(13), lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.02em", textWrap: "balance" }}>
            Record what you take,
            <br />
            help us keep this fridge full.
          </h2>
          <div style={{ width: u(92), height: u(92) }} dangerouslySetInnerHTML={{ __html: qr }} />
          <ol className="flex flex-col text-left" style={{ fontSize: u(5.6), lineHeight: 1.3, gap: u(2.2) }}>
            {["Scan the code with your phone", "Add the drinks you took", "Make a donation, or offer a crate"].map((s, i) => (
              <li key={s} className="flex items-center" style={{ gap: u(3.5) }}>
                <span
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{ width: u(8), height: u(8), border: `${u(0.5)} solid #000`, fontSize: u(4.4), fontWeight: 700 }}
                >
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        <div className="w-full text-center" style={{ borderTop: `${u(0.3)} solid #000`, paddingTop: u(5), fontSize: u(4), lineHeight: 1.4 }}>
          <p>The drinks are not for sale: they are here for everyone, and your donations buy the next crate.</p>
          <p>Members look after this fridge in their own time.</p>
          <p style={{ marginTop: u(2.5), fontSize: u(4.6), fontWeight: 600 }}>commonshub.brussels/fridge</p>
        </div>
      </div>
    </div>
  )
}
