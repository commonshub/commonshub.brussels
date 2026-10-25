import Link from "next/link"
import { Suspense } from "react"
import { CalendarDays, DoorOpen, Hand, Laptop, MapPin, MessageCircle, Presentation, UserRound } from "lucide-react"

import { Logo } from "@/components/logo"
import { MembershipPlanCard } from "@/components/dashboard/membership-plan"
import { UpcomingEvents } from "@/components/dashboard/upcoming-events"
import { planFor } from "@/lib/member-plan"
import { isApplicationsConfigured, listApplications } from "@/lib/membership-applications-store"
import settings from "@/settings/settings.json"

const discordChannel = (id: string) => `https://discord.com/channels/${settings.discord.guildId}/${id}`
const ELINOR = discordChannel(settings.discord.channels.elinor)

type User = { discordId: string; username: string; email?: string | null; avatar?: string | null }

/**
 * What a member sees at /, instead of the homepage (still at /homepage):
 * open the door, ask Elinor, cowork or book a room (for themselves or a
 * guest), vouch for applicants, what's coming up, and their membership plan.
 * Their token balance is in the header.
 */
export function MemberDashboard({ user }: { user: User }) {
  const plan = planFor(user)
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">Hi {user.username}</h1>
      <p className="mt-1 text-muted-foreground">Welcome home.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <form action="/api/door/open" method="post" className="contents">
          <button type="submit" className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-left text-primary-foreground shadow-sm transition hover:opacity-90">
            <DoorOpen className="h-8 w-8 shrink-0" />
            <span>
              <span className="block text-lg font-bold">Open the door</span>
              <span className="block text-sm opacity-90">Rue de la Madeleine 51</span>
            </span>
          </button>
        </form>
        <a href={ELINOR} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-2xl border-2 border-primary p-5 text-foreground transition hover:bg-primary/5">
          <MessageCircle className="h-8 w-8 shrink-0 text-primary" />
          <span>
            <span className="block text-lg font-bold">Ask Elinor</span>
            <span className="block text-sm text-muted-foreground">Our community assistant, on Discord</span>
          </span>
        </a>
      </div>

      <Suspense fallback={null}>
        <VouchCard />
      </Suspense>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ActionCard icon={<Laptop className="h-6 w-6 text-primary" />} title="Cowork" text="Come and work at the hub, or invite a guest for half a day or a day.">
          <ActionLink href="/coworking">For me</ActionLink>
          <ActionLink href={ELINOR} external hint="Ask Elinor, or use /guestpass on Discord">
            For a guest
          </ActionLink>
        </ActionCard>
        <ActionCard icon={<Presentation className="h-6 w-6 text-primary" />} title="Book a room" text="At the community price, for a meeting, a workshop or an event.">
          <ActionLink href="/rooms">For me</ActionLink>
          <ActionLink href={ELINOR} external hint="Ask Elinor, or use /book on Discord">
            For a guest
          </ActionLink>
        </ActionCard>
      </div>

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
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=96`} alt="" width={48} height={48} className="h-12 w-12 rounded-full" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{user.username.charAt(0).toUpperCase()}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-foreground">{user.username}</span>
              <span className="block text-sm text-muted-foreground">Your profile and contributions</span>
            </span>
          </Link>
          <MembershipPlanCard plan={plan} />
        </div>
      </section>

      <DashboardFooter />
    </div>
  )
}

function ActionCard({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        {icon} {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function ActionLink({ href, external, hint, children }: { href: string; external?: boolean; hint?: string; children: React.ReactNode }) {
  const className = "inline-flex rounded-full border-2 border-primary px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={hint}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
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
