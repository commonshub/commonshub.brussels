import type { Metadata } from "next"
import QRCode from "qrcode"

import { ContributeJars } from "@/components/screen/contribute-jars"
import { ScreenShell } from "@/components/screen/screen"
import { loadContributeExpenses } from "@/lib/contribute-expenses"
import { loadJars, loadLatestTransactions, loadTokenMoves } from "@/lib/contribute-jars"
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
 * For the hub's big screen: two jars keep the hub open. Money fills the
 * month's costs (as /contribute breaks them down) with what the community
 * paid this month; time fills with the hours given (one per token issued).
 * In between, the hub's latest money in and out, tagged by category, and the
 * latest tokens. Public: reads the public tier,
 * and names a donor only as they chose at checkout (see lib/contribute-jars.ts
 * and lib/contribute-screen.ts).
 */
export default async function ContributeScreenPage() {
  const data = await loadContributeScreen()
  const costs = screenCosts(loadContributeExpenses().recurring)
  const qrSvg = await QRCode.toString(CONTRIBUTE_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0 })
  const money = loadLatestTransactions(data.donations)
  const tokenMoves = loadTokenMoves()

  return (
    <ScreenShell title="Two jars keep this place open">
      <ContributeJars data={loadJars(costs)} money={money} tokenMoves={tokenMoves} qrSvg={qrSvg} url={CONTRIBUTE_URL} />
    </ScreenShell>
  )
}
