import type { Metadata, Viewport } from "next"

import { TabletBoard } from "@/components/tablet/tablet-board"
import { loadTablet } from "@/lib/tablet-data"

// Reads the dataset and the bot at request time.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign up for a shift | Commons Hub Brussels",
  description: "The community tablet at the Commons Hub: the week, what needs a steward and who is on shift.",
  robots: { index: false },
  // Installable on the hub's tablet: from the home screen it opens full screen, without the browser around it.
  manifest: "/tablet-app/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hub tablet", statusBarStyle: "black-translucent" },
  icons: { icon: "/tablet-app/icon-192.png", apple: "/tablet-app/icon-192.png" },
}

export const viewport: Viewport = { themeColor: "#FF4C02" }

/** The community tablet in the hub (portrait): a calendar a week at a time (?week=1 the next one, -1 the last), what needs a steward and who is on shift, to sign up and earn tokens. */
export default async function TabletPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const data = await loadTablet(Number((await searchParams).week) || 0)
  return <TabletBoard days={data.days} week={data.week} shiftsAvailable={data.shiftsAvailable} rewardAmountPerHour={data.rewardAmountPerHour} />
}
