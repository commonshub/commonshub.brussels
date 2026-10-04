import type { Metadata } from "next"
import QRCode from "qrcode"

import { ContributeBoard } from "@/components/screen/contribute-board"
import { ScreenShell } from "@/components/screen/screen"
import { loadContributeExpenses } from "@/lib/contribute-expenses"
import { loadContributeScreen, screenCosts } from "@/lib/contribute-screen"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Contribute, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/** Always the public address, whichever copy of the site is on the screen. */
const CONTRIBUTE_URL = "https://commonshub.brussels/contribute"

/**
 * For the hub's big screen: why the space exists, the two currencies that
 * keep it going (money: costs and latest donations; time: photos and recent
 * contributors), and a QR code to /contribute. Public: reads the public tier,
 * and names a donor only as they chose at checkout (see
 * lib/contribute-screen.ts).
 */
export default async function ContributeScreenPage() {
  const data = await loadContributeScreen()
  // The fixed costs, as /contribute shows them (public: no vendor that is a person is named).
  const costs = screenCosts(loadContributeExpenses().recurring)
  const qrSvg = await QRCode.toString(CONTRIBUTE_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0 })

  return (
    <ScreenShell title="Thank you to everyone who contributes">
      <ContributeBoard data={data} costs={costs} qrSvg={qrSvg} url={CONTRIBUTE_URL} />
    </ScreenShell>
  )
}
