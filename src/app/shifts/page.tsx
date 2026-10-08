import type { Metadata } from "next"

import { auth } from "@/auth"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { TabletBoard } from "@/components/tablet/tablet-board"
import { isMember } from "@/lib/admin-check"
import { loadTablet } from "@/lib/tablet-data"

// Reads the dataset, the shifts calendar and the session at request time.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign up for a shift | Commons Hub Brussels",
  description: "The hub needs a steward whenever it is open: see the week, what needs someone, who is on shift, and sign up.",
}

/**
 * /shifts: the community tablet's calendar (/tablet) for a member signed in
 * with Discord, from anywhere. Same calendar and sheets (TabletBoard), but the
 * member signs themselves up, and members see booking names and introductions.
 */
export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28">
        <h1 className="text-3xl font-bold text-foreground">Sign up for a shift</h1>
        <p className="mb-6 mt-2 text-muted-foreground">
          The hub needs someone whenever it’s open: welcome people, show them around, make them feel at home. Shifts earn tokens.
        </p>
        <SignInPrompt>Sign in with Discord to see the shifts and sign up.</SignInPrompt>
      </div>
    )
  }
  const member = await isMember()
  const data = await loadTablet(Number((await searchParams).week) || 0, Date.now(), member ? "members" : "public")
  const me = { id: session.user.discordId, displayName: session.user.name || session.user.username, avatar: session.user.image ?? null }
  return <TabletBoard days={data.days} week={data.week} trusted={member} shiftsAvailable={data.shiftsAvailable} rewardAmountPerHour={data.rewardAmountPerHour} me={me} />
}
