import type { Metadata } from "next"

import { HomePage } from "@/components/home-page"

export const metadata: Metadata = { alternates: { canonical: "/" } }

/** The public homepage, for members too: / shows them their dashboard instead. */
export default function Page() {
  return <HomePage />
}
