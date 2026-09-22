import Link from "next/link"
import { notFound } from "next/navigation"
import { DoorOpen, Lock, MapPin } from "lucide-react"

import { auth } from "@/auth"
import { DayNav } from "@/components/day/day-nav"
import { ShiftSignupPanel } from "@/components/day/shift-signup"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { isMember, isSteward } from "@/lib/admin-check"
import settings from "@/settings/settings.json"
import {
  DAY_RE,
  type ScheduleItem,
  buildDaySchedule,
  dayBounds,
  dayOf,
  formatTime,
  peopleAtTheDoor,
  shiftDay,
} from "@/lib/day"
import { slotCode, slotLabel } from "@/lib/nostr-conventions"
import { RELAYS } from "@/lib/nostr-server"
import { MAX_SIGNUPS_PER_SLOT, SHIFTS_DESCRIPTION, SHIFT_SLOTS, loadDoorOpenings, loadPublicEventsForDay, loadShiftSignups } from "@/lib/day-data"
import { getProxiedImageUrl } from "@/lib/image-proxy"
import { fetchRoomEventsForRange } from "@/lib/room-calendar"

// Reads the dataset and live calendars: never prerender.
export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ year: string; month: string; day: string }>
}

const longDate = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", opts)

export async function generateMetadata({ params }: PageProps) {
  const { year, month, day } = await params
  const date = `${year}-${month}-${day}`
  if (!DAY_RE.test(date)) return {}
  return { title: `${longDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at the Commons Hub` }
}

function Item({ item }: { item: ScheduleItem }) {
  const isBooking = item.kind === "booking"
  const hidden = isBooking && item.title === "Booked"
  const time = item.allDay ? "All day" : `${formatTime(item.start)}–${formatTime(item.end)}`
  const body = (
    <div className={`flex gap-3 rounded-lg border p-3 sm:p-4 ${hidden ? "border-dashed border-border bg-muted/40" : "border-border bg-card"}`}>
      <div className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground sm:w-28">{time}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-semibold ${hidden ? "text-muted-foreground" : "text-foreground"}`}>{item.title}</span>
          <Badge variant={isBooking ? "outline" : "secondary"}>{isBooking ? "booking" : "public event"}</Badge>
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {item.roomName}
        </div>
        {item.description && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{item.description}</p>}
      </div>
    </div>
  )
  return item.url ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block transition hover:shadow-md">
      {body}
    </a>
  ) : (
    body
  )
}

export default async function DayPage({ params }: PageProps) {
  const { year, month, day } = await params
  const date = `${year}-${month}-${day}`
  if (!DAY_RE.test(date)) notFound()

  const session = await auth()
  const me = (session?.user as { discordId?: string } | undefined)?.discordId
  const member = !!me && (await isMember())
  const steward = member && (await isSteward())
  const { start, end } = dayBounds(date)

  const [bookings, publicEvents, openings, signups] = await Promise.all([
    fetchRoomEventsForRange(start, end).catch(() => []),
    Promise.resolve(loadPublicEventsForDay(date)),
    loadDoorOpenings(date),
    loadShiftSignups(date),
  ])

  const schedule = buildDaySchedule(date, bookings, publicEvents, { isMember: member })
  const people = peopleAtTheDoor(openings)
  const today = dayOf(new Date())
  const publicCount = schedule.filter((i) => i.kind === "public").length
  const bookingCount = schedule.length - publicCount

  return (
    <main className="min-h-screen">
      <section className="pt-24 pb-8 sm:pt-32 sm:pb-10 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <DayNav previous={shiftDay(date, -1)} next={shiftDay(date, 1)}>
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {longDate(date, { weekday: "long" })}
                {date === today && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">today</span>}
              </div>
              <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-4xl">{longDate(date, { day: "numeric", month: "long", year: "numeric" })}</h1>
            </div>
          </DayNav>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {publicCount} public event{publicCount === 1 ? "" : "s"} · {bookingCount} booking{bookingCount === 1 ? "" : "s"}
            {" · "}
            <Link href={`/${year}/${month}`} className="underline-offset-2 hover:underline">
              {longDate(date, { month: "long" })} report
            </Link>
          </p>
        </div>
      </section>

      <section className="py-8 sm:py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-10">
          <div className="flex flex-col gap-5">
            {!member && (
              <SignInPrompt>
                <Lock className="mr-1 inline h-4 w-4" />
                Bookings are shown without details. Members see them in full, who is in the space, and can take a shift.
              </SignInPrompt>
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Schedule</h2>
              {schedule.length === 0 ? (
                <p className="mt-3 text-muted-foreground">Nothing in the calendars for this day.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:gap-3">
                  {schedule.map((item) => (
                    <Item key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-8">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-foreground sm:text-xl">
                <DoorOpen className="h-5 w-5 text-primary" />
                At the door
              </h2>
              {people.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {date < today ? "The door log for this day is out of reach." : "Nobody has opened the door yet."}
                </p>
              ) : member ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {people.map((person) => (
                    <li key={person.userId || person.name} className="flex items-center gap-3 text-sm">
                      <Avatar className="h-8 w-8">
                        {person.avatar && <AvatarImage src={getProxiedImageUrl(person.avatar, "sm", { relative: true })} alt="" />}
                        <AvatarFallback>{person.name.replace(/^<@.*>$/, "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{person.name}</span>
                      <span className="tabular-nums text-muted-foreground">{formatTime(person.firstAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {people.slice(0, 5).map((person, i) => (
                      <Avatar key={person.userId || person.name} className="h-8 w-8 ring-2 ring-background" style={{ zIndex: 5 - i }}>
                        {person.avatar && <AvatarImage src={getProxiedImageUrl(person.avatar, "sm", { relative: true })} alt="" />}
                        <AvatarFallback className="text-xs">·</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {people.length} {people.length === 1 ? "person" : "people"} so far. Log in to see who.
                  </p>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">From the #door channel on Discord.</p>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground sm:text-xl">Shifts</h2>
              <p className="mt-1 text-sm text-muted-foreground">{SHIFTS_DESCRIPTION}</p>
              <div className="mt-3">
                {member && me ? (
                  <ShiftSignupPanel day={date} slots={SHIFT_SLOTS} initial={signups} me={me} maxPerSlot={MAX_SIGNUPS_PER_SLOT} relays={RELAYS} steward={steward} memberRoleId={settings.discord.roles.member} />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {SHIFT_SLOTS.map((slot) => {
                      const taken = signups.filter((s) => s.slotCode === slotCode(slot)).length
                      return (
                        <li key={slotCode(slot)} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
                          <span className="font-semibold tabular-nums text-foreground">{slotLabel(slot)}</span>
                          <span className="text-muted-foreground">
                            {taken === 0 ? "Nobody yet" : `${taken}/${MAX_SIGNUPS_PER_SLOT}`}
                          </span>
                        </li>
                      )
                    })}
                    <li className="text-xs text-muted-foreground">Log in as a member to take a shift.</li>
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
