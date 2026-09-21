import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, CalendarDays, DoorOpen, Lock, MapPin } from "lucide-react"

import { auth } from "@/auth"
import { ShiftSignupPanel } from "@/components/day/shift-signup"
import { SignInPrompt } from "@/components/day/sign-in-prompt"
import { Badge } from "@/components/ui/badge"
import { isMember } from "@/lib/admin-check"
import {
  DAY_RE,
  type ScheduleItem,
  buildDaySchedule,
  dayBounds,
  dayOf,
  formatDayLong,
  formatTime,
  peopleAtTheDoor,
  shiftDay,
} from "@/lib/day"
import { SHIFT_SLOTS, loadDoorOpenings, loadPublicEventsForDay, loadShiftSignups } from "@/lib/day-data"
import { fetchRoomEventsForRange } from "@/lib/room-calendar"

// Reads the dataset and live calendars: never prerender.
export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ year: string; month: string; day: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { year, month, day } = await params
  const date = `${year}-${month}-${day}`
  if (!DAY_RE.test(date)) return {}
  return { title: `${formatDayLong(date)} at the Commons Hub` }
}

function Item({ item }: { item: ScheduleItem }) {
  const isBooking = item.kind === "booking"
  const time = item.allDay ? "All day" : `${formatTime(item.start)} – ${formatTime(item.end)}`
  const body = (
    <div
      className={`flex gap-4 rounded-lg border p-4 ${
        isBooking && item.title === "Booked" ? "border-dashed border-border bg-muted/40" : "border-border bg-card"
      }`}
    >
      <div className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground">{time}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-semibold ${item.title === "Booked" ? "text-muted-foreground" : "text-foreground"}`}>{item.title}</span>
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
  const { start, end } = dayBounds(date)

  const [bookings, publicEvents, openings, signups] = await Promise.all([
    fetchRoomEventsForRange(start, end).catch(() => []),
    Promise.resolve(loadPublicEventsForDay(date)),
    loadDoorOpenings(date),
    loadShiftSignups(date),
  ])

  const schedule = buildDaySchedule(date, bookings, publicEvents, { isMember: member })
  const people = peopleAtTheDoor(openings)
  const isToday = dayOf(new Date()) === date
  const isPast = date < dayOf(new Date())

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-10 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href={`/${shiftDay(date, -1).replace(/-/g, "/")}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Previous day
            </Link>
            <Link href={`/${year}/${month}`} className="text-sm text-muted-foreground hover:text-foreground">
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })} report
            </Link>
            <Link href={`/${shiftDay(date, 1).replace(/-/g, "/")}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Next day <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-foreground flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            {formatDayLong(date)}
            {isToday && <Badge>Today</Badge>}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {schedule.filter((i) => i.kind === "public").length} public event
            {schedule.filter((i) => i.kind === "public").length === 1 ? "" : "s"},{" "}
            {schedule.filter((i) => i.kind === "booking").length} booking
            {schedule.filter((i) => i.kind === "booking").length === 1 ? "" : "s"}
            {member ? "" : " · bookings are shown without details"}
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            {!member && (
              <SignInPrompt>
                <Lock className="mr-1 inline h-4 w-4" />
                Members see every booking in full, who is in the space, and can take a shift.
              </SignInPrompt>
            )}
            <div>
              <h2 className="text-2xl font-bold text-foreground">Schedule</h2>
              {schedule.length === 0 ? (
                <p className="mt-4 text-muted-foreground">Nothing in the calendars for this day.</p>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  {schedule.map((item) => (
                    <Item key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-8">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                <DoorOpen className="h-5 w-5 text-primary" />
                At the door
              </h2>
              {people.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {isPast ? "The door log for this day is no longer within reach." : "Nobody has opened the door yet."}
                </p>
              ) : member ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {people.map((person) => (
                    <li key={person.userId || person.name} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{person.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatTime(person.lastAt)}
                        {person.count > 1 ? ` · ×${person.count}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {people.length} {people.length === 1 ? "person has" : "people have"} opened the door today. Log in to see who.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">From the #door channel on Discord.</p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground">Shifts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Someone takes care of the space, welcomes people and opens the door.
              </p>
              <div className="mt-3">
                {member && me ? (
                  <ShiftSignupPanel day={date} slots={SHIFT_SLOTS} initial={signups} me={me} />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {SHIFT_SLOTS.map((slot) => {
                      const people = signups.filter((s) => s.slot === slot.id)
                      return (
                        <li key={slot.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                          <span className="font-semibold text-foreground">{slot.label}</span>{" "}
                          <span className="text-muted-foreground">· {slot.time}</span>
                          <div className="mt-1 text-muted-foreground">
                            {people.length === 0 ? "Nobody yet" : `${people.length} ${people.length === 1 ? "person" : "people"} signed up`}
                          </div>
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
