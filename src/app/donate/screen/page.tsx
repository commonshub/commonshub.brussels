import type { Metadata } from "next"
import QRCode from "qrcode"

import { DonateToday } from "@/components/screen/donate-today"
import { ScreenShell } from "@/components/screen/screen"
import { loadContributeExpenses } from "@/lib/contribute-expenses"
import { screenCosts } from "@/lib/contribute-screen"
import { loadDonateToday } from "@/lib/donate-today"

// Reads DATA_DIR and live payments at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Money raised today, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/** Always the public address, whichever copy of the site is on the screen. */
const DONATE_URL = "https://commonshub.brussels/donate"

/**
 * For the hub's big screen: the money received today by card (Stripe) and
 * bank transfer (Monerium), live, on a bar as long as a month of the
 * hub's fixed costs (as /contribute breaks them down), on top of what came
 * in earlier this month. The page polls /api/donate/today.
 */
export default async function DonateScreenPage() {
  const costs = screenCosts(loadContributeExpenses().recurring)
  const qrSvg = await QRCode.toString(DONATE_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0 })
  return (
    <ScreenShell title="Money raised for the Commons Hub today">
      <DonateToday initial={await loadDonateToday()} costs={costs} qrSvg={qrSvg} url={DONATE_URL} />
    </ScreenShell>
  )
}
