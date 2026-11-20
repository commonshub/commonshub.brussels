import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, CalendarDays, Eye, Presentation } from "lucide-react"

import { ActionToggle } from "@/components/dashboard/action-toggle"
import { HubBookingButton } from "@/components/dashboard/hub-booking"

import { CoworkBox } from "@/components/dashboard/cowork-box"
import { LinkDiscordCard } from "@/components/dashboard/link-discord"
import { HubAccess, lockedReason } from "@/components/dashboard/hub-access"
import { UnpaidInvoices } from "@/components/dashboard/unpaid-invoices"
import { LatestTransactions } from "@/components/dashboard/latest-transactions"
import { MembershipStatus } from "@/components/dashboard/membership-status"
import { membershipStanding } from "@/lib/membership-standing"
import { MyBookings } from "@/components/dashboard/my-bookings"
import { OrganisationsCard, type Org } from "@/components/dashboard/my-organisations"
import { UpcomingEvents } from "@/components/dashboard/upcoming-events"
import { callTokenBot } from "@/lib/token-bot"

/**
 * What someone signed in with an email code (no Discord, e.g. a contact of an organisation in Odoo)
 * sees at /: book a room or coworking (in euros, or with their organisation's room credits), their
 * organisations, their bookings and invoices, what's coming up.
 * `viewAs`: an admin looking at it (/?as=<email>): read-only.
 */
const ACTION = "inline-flex rounded-full border-2 border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"

export async function EmailDashboard({ email, name, paid, linked, viewAs }: { email: string; name?: string | null; paid?: string; linked?: boolean; viewAs?: { by: string } }) {
  const who = { emailUser: { email } }
  const [answer, acct, standing] = await Promise.all([callTokenBot("orgs", who).catch(() => null), callTokenBot("account", who).catch(() => null), membershipStanding({ email })])
  const discordLinked = acct?.body.ok ? (acct.body as { discordLinked?: boolean }).discordLinked : undefined
  const known = !!answer?.body.ok
  const orgs = known ? ((answer!.body as { orgs?: Org[] }).orgs ?? []) : []
  const shown = (known && (answer!.body as { me?: { name?: string } }).me?.name) || name || email
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      {viewAs && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <Eye className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm">
            <span className="font-bold">Viewing as {email}</span>, as if they signed in with that address. Buttons are off.{" "}
            {!known && answer?.status === 404 ? "Odoo has no contact with that address: they couldn't sign in. " : ""}
            <Link href="/" className="font-semibold underline">
              Back to mine
            </Link>
          </p>
        </div>
      )}
      <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">Hi {shown}</h1>
      <p className="mt-1 text-muted-foreground">Welcome to the Commons Hub.</p>
      {linked && discordLinked && <p className="mt-4 rounded-xl bg-green-100 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">Your Discord account is linked.</p>}
      {!viewAs && known && discordLinked === false && <LinkDiscordCard />}

      <MembershipStatus standing={standing} viewAs={!!viewAs} />
      <HubAccess name={shown} readOnly={!!viewAs} locked={lockedReason(standing.state, viewAs ? "they" : "you")} />
      <Suspense fallback={null}>
        <UnpaidInvoices who={who} readOnly={!!viewAs} />
      </Suspense>

      <div className="mt-6 grid min-w-0 items-start gap-4 sm:grid-cols-2">
        <ActionToggle icon={<Presentation className="h-6 w-6 text-primary" />} title="Book a room" text="For a meeting, a workshop or an event: paid in euros, or with your organisation's room credits." disabled={!!viewAs || !known}>
          <HubBookingButton mode="room-me" className={ACTION}>
            For me
          </HubBookingButton>
          <HubBookingButton mode="room-guest" className={ACTION}>
            For a guest
          </HubBookingButton>
        </ActionToggle>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-muted" />}>
          <CoworkBox who={who} guest={false} disabled={!!viewAs || !known} text="A half day or a day at the hub, or unlimited coworking every month, paid in euros." />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <MyBookings who={who} paid={paid} readOnly={!!viewAs} />
      </Suspense>

      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        <OrganisationsCard orgs={orgs} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
          <CalendarDays className="h-5 w-5 text-primary" /> Upcoming events
        </h2>
        <UpcomingEvents />
      </section>

      <Suspense fallback={null}>
        <LatestTransactions who={who} discordId={standing.application?.discordId ?? null} />
      </Suspense>

      <Link href="/homepage" className="mt-10 flex items-center justify-between gap-4 rounded-2xl bg-muted p-5 transition hover:bg-muted/70">
        <span>
          <span className="block font-bold text-foreground">See the homepage</span>
          <span className="block text-sm text-muted-foreground">Rooms, coworking and membership</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
      </Link>
    </div>
  )
}
