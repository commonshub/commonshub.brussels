import type { Metadata } from "next"

import { ConstellationScreen, WallScreen } from "./designs"

// Reads DATA_DIR, which is only mounted at runtime, and picks a design per request.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Thank you, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/**
 * For the hub's big screen: the thank-yous from 💝praise and the latest
 * #contributions, in one of two designs picked at random each time the page
 * loads (/screen reloads its slides every ten minutes, so both get their
 * turn): /contributions/screen/1 (a constellation of who thanked whom) or
 * /contributions/screen/2 (a wall of notes and polaroids).
 */
export default function ContributionsScreenPage() {
  return Math.random() < 0.5 ? <ConstellationScreen /> : <WallScreen />
}
