import type { Metadata } from "next"

import { TabletBoard } from "@/components/tablet/tablet-board"
import { loadTablet } from "@/lib/tablet-data"

// Reads the dataset and the bot at request time.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign up for a shift | Commons Hub Brussels",
  description: "The community tablet at the Commons Hub: the coming two weeks, what needs a steward and who is on shift.",
  robots: { index: false },
}

/** The community tablet in the hub (portrait): a calendar of the coming days, what needs a steward and who is on shift, to sign up and earn tokens. */
export default async function TabletPage() {
  const data = await loadTablet()
  return <TabletBoard days={data.days} shiftsAvailable={data.shiftsAvailable} rewardAmountPerHour={data.rewardAmountPerHour} />
}
