import type { Metadata } from "next"

import { WallScreen } from "../designs"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Thank you, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/** For the hub's big screen: a wall of thank-you notes and contribution polaroids (💝praise and #contributions). */
export default function ContributionsScreen2() {
  return <WallScreen />
}
