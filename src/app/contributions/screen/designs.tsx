import QRCode from "qrcode"

import { GratitudeConstellation } from "@/components/screen/gratitude-constellation"
import { ScreenShell } from "@/components/screen/screen"
import { ThankYouWall } from "@/components/screen/thank-you-wall"
import { gratitudeGraph, loadContributionsScreen } from "@/lib/contributions-screen"
import settings from "@/settings/settings.json"

/** The 💝praise channel, where a thank-you is posted. */
const PRAISE_URL = `https://discord.com/channels/${settings.discord.guildId}/${settings.discord.channels.praise}`

const qr = () => QRCode.toString(PRAISE_URL, { type: "svg", errorCorrectionLevel: "M", margin: 0 })

/** Design 1: who thanked whom, as a constellation. */
export async function ConstellationScreen() {
  const { praises } = loadContributionsScreen()
  const { nodes, edges } = gratitudeGraph(praises)
  return (
    <ScreenShell title="Who thanked whom lately">
      <GratitudeConstellation nodes={nodes} edges={edges} praises={praises} qrSvg={await qr()} url={PRAISE_URL} cta="Thank someone" label="💝praise on Discord" />
    </ScreenShell>
  )
}

/** Design 2: a wall of sticky notes and polaroids. */
export async function WallScreen() {
  const { praises, contributions } = loadContributionsScreen()
  return (
    <ScreenShell title="Small things that keep the hub alive">
      <ThankYouWall praises={praises} contributions={contributions} qrSvg={await qr()} url={PRAISE_URL} cta="Thank someone" label="💝praise on Discord" />
    </ScreenShell>
  )
}
