import type { Metadata } from "next"

import { PassView } from "@/components/pass/pass-view"

export const metadata: Metadata = {
  title: "Coworking pass | Commons Hub Brussels",
  description: "A guest pass to the Commons Hub Brussels: when it works, where we are, and a button that opens the door.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

/** Static: the pass is read in the browser, from the URL fragment (lib/guest-pass.ts). */
export default function PassPage() {
  return <PassView />
}
