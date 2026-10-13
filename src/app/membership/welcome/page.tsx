import type { Metadata } from "next"

import { auth } from "@/auth"
import { WelcomeClaim } from "@/components/membership/welcome-claim"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Welcome, new member! | Commons Hub Brussels",
  description: "Thank you for joining the Commons Hub Brussels.",
  robots: { index: false },
}

/**
 * Where Stripe sends a new member after paying (`?session_id=`), and where the
 * onboarding email points (`?t=`): thank you, and log in with Discord to get
 * the member role (which opens the door).
 */
export default async function MembershipWelcomePage({ searchParams }: { searchParams: Promise<{ session_id?: string; t?: string }> }) {
  const { session_id, t } = await searchParams
  const session = await auth()
  return (
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-28">
      <div className="text-5xl">🌸</div>
      <h1 className="mt-4 text-4xl font-bold text-foreground">Welcome, new member!</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Thank you for joining this community of courageous commoners! Memberships are how we pay the rent and keep this common space open for everyone.
      </p>
      <WelcomeClaim
        sessionId={session_id ?? null}
        token={t ?? null}
        user={session?.user ? { name: session.user.name || session.user.username || "", image: session.user.image ?? null } : null}
      />
      <div className="mt-12 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">What's next</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            Open the door: in the <span className="font-medium text-foreground">#door</span> channel on Discord, type “open” (or use /open).
          </li>
          <li>Come to the Heartbeat, every Monday 13:00–14:00 at the hub: what's happening, what's needed, who does what.</li>
          <li>
            Take a first <a href="/shifts" className="text-primary underline">shift</a>: the quickest way to meet everyone, and you earn tokens.
          </li>
          <li>
            Read the <a href="/handbook" className="text-primary underline">handbook</a>: the door, the kitchen, the rooms, the tokens.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">You'll also receive all this by email.</p>
      </div>
    </main>
  )
}
