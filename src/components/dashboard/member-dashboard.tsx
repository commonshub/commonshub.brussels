import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, CalendarDays, Eye, Hand, MapPin, Presentation, UserRound } from "lucide-react"

import { Logo } from "@/components/logo"
import { ActionToggle } from "@/components/dashboard/action-toggle"
import { AddEmailCard } from "@/components/dashboard/add-email"
import { CoworkBox } from "@/components/dashboard/cowork-box"
import { HubAccess, lockedReason } from "@/components/dashboard/hub-access"
import { LatestTransactions } from "@/components/dashboard/latest-transactions"
import { HubBookingButton } from "@/components/dashboard/hub-booking"
import { MyBookings } from "@/components/dashboard/my-bookings"
import { MyOrganisations } from "@/components/dashboard/my-organisations"
import { TodayAtTheHub } from "@/components/dashboard/today-at-the-hub"
import { NextShiftCard, SignUpForShift } from "@/components/dashboard/next-shift"
import { MembershipPlanCard } from "@/components/dashboard/membership-plan"
import { UpcomingEvents } from "@/components/dashboard/upcoming-events"
import { getProxiedImageUrl } from "@/lib/image-proxy"
import { findPlan } from "@/lib/member-plan"
import { isUnpaid } from "@/lib/membership-standing"
import { callTokenBot } from "@/lib/token-bot"
import { chbPubkey, needsEmail } from "@/lib/partner-email"
import { isApplicationsConfigured, listApplications } from "@/lib/membership-applications-store"
import settings from "@/settings/settings.json"


type User = { discordId: string; username: string; email?: string | null; avatar?: string | null }

/**
 * What a member sees at /, instead of the homepage (still at /homepage):
 * open the door (without leaving the page), ask Elinor, today at the hub (who came in, today's
 * events), cowork or book a room (for themselves or a guest), their bookings, their next shift (or
 * sign up for one), vouch for applicants, what's coming up, their membership plan and organisations.
 * `viewAs`: an admin looking at this member's dashboard (/?as=<username>): read-only.
 * When chb has no email for their membership, a card asks for one (lib/partner-email.ts).
 * Their token balance is in the header.
 */
export async function MemberDashboard({ user, paid, viewAs }: { user: User; paid?: string; viewAs?: { by: string } }) {
  const { plan, candidate } = await findPlan(user)
  const readOnly = !!viewAs
  const avatar = user.avatar ? (user.avatar.startsWith("http") ? user.avatar : `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=96`) : null
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      {viewAs && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <Eye className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-sm">
            <span className="font-bold">Viewing as {user.username}.</span> This is their dashboard, read-only: buttons are off. The token balance in the header is still yours.{" "}
            <Link href="/" className="font-semibold underline">
              Back to mine
            </Link>
          </p>
        </div>
      )}
      <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">Hi {user.username}</h1>
      <p className="mt-1 text-muted-foreground">Welcome home.</p>

      {/* Their Discord member role lets them in; a membership that's clearly no longer paid locks it. */}
      <HubAccess name={user.username} readOnly={readOnly} locked={isUnpaid(plan) ? lockedReason("ended", viewAs ? "they" : "you") : null} />

      <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded-2xl bg-muted" />}>
        <TodayAtTheHub me={{ username: user.username, avatar }} />
      </Suspense>

      <div className="mt-4 grid min-w-0 items-start gap-4 sm:grid-cols-2">
        <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-muted" />}>
          <CoworkBox who={user.discordId} guest disabled={readOnly} text="Contributor coworking with your tokens, a guest pass for half a day or a day, or unlimited coworking every month." />
        </Suspense>
        <ActionToggle icon={<Presentation className="h-6 w-6 text-primary" />} title="Book a room" text="With your tokens, for a meeting, a workshop or an event." disabled={readOnly}>
          <HubBookingButton mode="room-me" className={ACTION}>
            For me
          </HubBookingButton>
          <HubBookingButton mode="room-guest" className={ACTION}>
            For a guest
          </HubBookingButton>
        </ActionToggle>
      </div>

      <Suspense fallback={null}>
        <MyBookings who={user.discordId} paid={paid} readOnly={readOnly} />
      </Suspense>

      {!readOnly && chbPubkey() && (
        <Suspense fallback={null}>
          <EmailPrompt discordId={user.discordId} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <VouchCard />
      </Suspense>

      <Suspense fallback={<SignUpForShift />}>
        <NextShiftCard user={user} />
      </Suspense>

      {/* id="events": the header's "Events" (/#events) lands here for members. */}
      <section id="events" className="mt-10 scroll-mt-20">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" /> Upcoming events
          </h2>
          <Link href="/homepage#events" className="text-sm text-primary hover:underline">
            All events
          </Link>
        </div>
        <UpcomingEvents />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
          <UserRound className="h-5 w-5 text-primary" /> Profile
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href={`/members/${user.username}`} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:bg-muted">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getProxiedImageUrl(avatar)} alt="" width={48} height={48} className="h-12 w-12 rounded-full" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{user.username.charAt(0).toUpperCase()}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-foreground">{user.username}</span>
              <span className="block text-sm text-muted-foreground">Your profile and contributions</span>
            </span>
          </Link>
          <fieldset disabled={readOnly} className="min-w-0">
            <MembershipPlanCard plan={plan} candidate={candidate} discordId={user.discordId} />
          </fieldset>
          <Suspense fallback={null}>
            <MyOrganisations who={user.discordId} />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={null}>
        <LatestTransactions who={user.discordId} discordId={user.discordId} />
      </Suspense>

      <Link href="/homepage" className="mt-10 flex items-center justify-between gap-4 rounded-2xl bg-muted p-5 transition hover:bg-muted/70">
        <span>
          <span className="block font-bold text-foreground">See the homepage</span>
          <span className="block text-sm text-muted-foreground">The Commons Hub as everyone else sees it</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
      </Link>

      <DashboardFooter />
    </div>
  )
}

const ACTION = "inline-flex rounded-full border-2 border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"

/**
 * Add an email, proved with a code: when chb has none for their Odoo contact, or the bot has none
 * for them (it invoices and finds their organisations by it). Both get it, and their Odoo contact
 * their Discord account.
 */
async function EmailPrompt({ discordId }: { discordId: string }) {
  if (needsEmail(discordId)) return <AddEmailCard />
  const a = await callTokenBot("account", discordId).catch(() => null)
  return a?.body.ok && (a.body as { hasEmail?: boolean }).hasEmail === false ? <AddEmailCard /> : null
}

/** Shown only while someone is waiting for vouches. */
async function VouchCard() {
  if (!isApplicationsConfigured()) return null
  const pending = await listApplications()
    .then((all) => all.filter((a) => a.status === "pending").length)
    .catch(() => 0)
  if (!pending) return null
  return (
    <Link href="/members/pending" className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 p-5 transition hover:bg-primary/10">
      <Hand className="h-7 w-7 shrink-0 text-primary" />
      <span>
        <span className="block font-bold text-foreground">
          {pending === 1 ? "1 person is" : `${pending} people are`} waiting to become {pending === 1 ? "a member" : "members"}
        </span>
        <span className="block text-sm text-muted-foreground">Vouch for the people you know or met at the hub</span>
      </span>
    </Link>
  )
}

function DashboardFooter() {
  const links = [
    { label: "Google Maps", href: settings.socials.map, icon: <MapPin className="h-4 w-4" /> },
    { label: "LinkedIn", href: settings.socials.linkedin },
    { label: "X", href: settings.socials.twitter },
    { label: "Mastodon", href: settings.socials.mastodon },
  ].filter((l) => l.href)
  return (
    <footer className="mt-14 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-center gap-2">
        <Logo className="h-6 w-6" /> Commons Hub Brussels · Rue de la Madeleine 51
      </span>
      <nav className="flex flex-wrap gap-x-5 gap-y-2">
        {links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            {l.icon}
            {l.label}
          </a>
        ))}
        <Link href="/homepage" className="hover:text-foreground">
          Homepage
        </Link>
      </nav>
    </footer>
  )
}
