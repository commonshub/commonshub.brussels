import type { Metadata } from "next"

import { ConstellationScreen } from "../designs"

// Reads DATA_DIR, which is only mounted at runtime: never prerender.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Thank you, on screen | Commons Hub Brussels",
  robots: { index: false },
}

/** For the hub's big screen: who thanked whom, as a constellation (💝praise and #contributions). */
export default function ContributionsScreen1() {
  return <ConstellationScreen />
}
