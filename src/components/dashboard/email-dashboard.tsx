import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, CalendarDays, Eye } from "lucide-react"

import { MyBookings } from "@/components/dashboard/my-bookings"
import { OrganisationsCard, type Org } from "@/components/dashboard/my-organisations"
import { UpcomingEvents } from "@/components/dashboard/upcoming-events"
import { callTokenBot } from "@/lib/token-bot"

/**
 * What someone signed in with an email code (no Discord, e.g. a contact of an organisation in Odoo)
 * sees at /: their organisations, their bookings and invoices (read-only), what's coming up.
 * `viewAs`: an admin looking at it (/?as=<email>).
 */
export async function EmailDashboard({ email, name, viewAs }: { email: string; name?: string | null; viewAs?: { by: string } }) {
  const who = { emailUser: { email } }
  const answer = await callTokenBot("orgs", who).catch(() => null)
  const known = !!answer?.body.ok
  const orgs = known ? ((answer!.body as { orgs?: Org[] }).orgs ?? []) : []
  const shown = (known && (answer!.body as { me?: { name?: string } }).me?.name) || name || email
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      {viewAs && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <Eye className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm">
            <span className="font-bold">Viewing as {email}</span>, as if they signed in with that address.{" "}
            {!known && answer?.status === 404 ? "Odoo has no contact with that address: they couldn't sign in. " : ""}
            <Link href="/" className="font-semibold underline">
              Back to mine
            </Link>
          </p>
        </div>
      )}
      <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">Hi {shown}</h1>
      <p className="mt-1 text-muted-foreground">Welcome to the Commons Hub.</p>

      <div className="mt-6 grid items-start gap-4 sm:grid-cols-2">
        <OrganisationsCard orgs={orgs} />
      </div>

      <Suspense fallback={null}>
        <MyBookings who={who} readOnly />
      </Suspense>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
          <CalendarDays className="h-5 w-5 text-primary" /> Upcoming events
        </h2>
        <UpcomingEvents />
      </section>

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
