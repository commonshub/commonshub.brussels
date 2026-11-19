import { FlaskConical, Presentation } from "lucide-react"

import { ActionToggle } from "@/components/dashboard/action-toggle"
import { CoworkBox } from "@/components/dashboard/cowork-box"
import { HubBookingButton } from "@/components/dashboard/hub-booking"
import { MyBookings } from "@/components/dashboard/my-bookings"
import { botIdentity } from "@/lib/token-bot"

const ACTION = "inline-flex rounded-full border-2 border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"

/**
 * What a test user (an address in the bot's TEST_LOGIN_EMAILS, signed in with an email code)
 * sees at /: coworking and rooms paid in euros, with invoices in the test copy of Odoo and cards
 * in Stripe's sandbox. Nothing is booked for real.
 */
type TestUser = Parameters<typeof botIdentity>[0] & { username?: string; name?: string | null; email?: string | null }

export function TestDashboard({ user, paid }: { user: TestUser; paid?: string }) {
  const name = user?.username || user?.name || "Test user"
  const email = user?.email
  const who = botIdentity(user)
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p className="text-sm">
          <span className="font-bold">Test mode.</span> You&apos;re signed in as a test user{email ? ` (${email})` : ""}. Invoices go to the test copy of Odoo, card payments to Stripe&apos;s sandbox (use card 4242 4242 4242 4242, any future date, any CVC), and no room is really booked.
        </p>
      </div>
      <h1 className="mt-8 text-3xl font-extrabold text-foreground sm:text-4xl">Hi {name}</h1>
      {who && <MyBookings who={who} paid={paid} />}
      <div className="mt-6 grid items-start gap-4 sm:grid-cols-2">
        {who && <CoworkBox who={who} guest={false} text="Coworking for today, or unlimited coworking every month, paid in euros." />}
        <ActionToggle icon={<Presentation className="h-6 w-6 text-primary" />} title="Book a room" text="A room, paid in euros, for you or a guest.">
          <HubBookingButton mode="room-me" className={ACTION}>
            For me
          </HubBookingButton>
          <HubBookingButton mode="room-guest" className={ACTION}>
            For a guest
          </HubBookingButton>
        </ActionToggle>
      </div>
    </div>
  )
}
