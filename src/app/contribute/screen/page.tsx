import type { Metadata } from "next"
import QRCode from "qrcode"

import { ContributeBoard } from "@/components/screen/contribute-board"
import { ScreenShell } from "@/components/screen/screen"
import { loadContributeScreen } from "@/lib/contribute-screen"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contribute, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/** Always the public address, whichever copy of the site is on the screen. */
const CONTRIBUTE_URL = "https://commonshub.brussels/contribute"

/**
 * For the hub's big screen: why the space exists, a QR code to /contribute,
 * and the people who keep it going. Public: reads the public tier only and
 * names nobody the site does not already name to anonymous visitors (see
 * lib/contribute-screen.ts).
 */
export default async function ContributeScreenPage() {
  const data = await loadContributeScreen()
  const qrSvg = await QRCode.toString(CONTRIBUTE_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0 })

  return (
    <ScreenShell title="Thank you to everyone who contributes">
      <ContributeBoard data={data} qrSvg={qrSvg} url={CONTRIBUTE_URL} seed={new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })} />
    </ScreenShell>
  )
}
