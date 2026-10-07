import type { Metadata } from "next"
import Link from "next/link"

import { hostedEventPath, hostedEvents } from "@/lib/hosted-events"
import { ScreenPreview } from "./screen-preview"

export const metadata: Metadata = {
  title: "Screens | Commons Hub Brussels",
  description: "Every page made for the screens at the Commons Hub, with a live preview.",
  robots: { index: false },
}

interface Screen {
  path: string
  title: string
  about: string
  portrait?: boolean
}

const GROUPS: Array<{ title: string; intro: string; screens: Screen[] }> = [
  {
    title: "The big screen",
    intro: "What the TV at the hub shows: /screen takes turns through the screens below, each design in turn.",
    screens: [{ path: "/screen", title: "Rotation", about: "Today's event programme, upcoming events, members, contribute, thank-yous. Arrow keys skip ahead." }],
  },
  {
    title: "Upcoming events",
    intro: "Weekly events (Heartbeat, park cleaning, potluck) are shown once, as recurring. /events/screen picks one design at random.",
    screens: [
      { path: "/events/screen/1", title: "Agenda", about: "The next event, or the featured one, up front; the rest by week." },
      { path: "/events/screen/2", title: "Two weeks", about: "This week and next as a calendar, Monday to Sunday." },
      { path: "/events/screen/3", title: "Month", about: "Five weeks from this Monday; the next or featured event on the side." },
    ],
  },
  {
    title: "Community",
    intro: "",
    screens: [
      { path: "/members/screen", title: "Members", about: "The logo beats; partners and members light up as the wave reaches them." },
      { path: "/contribute/screen", title: "Two jars", about: "Money fills the month's costs, time fills with the hours given." },
    ],
  },
  {
    title: "Thank-yous",
    intro: "From 💝praise and #contributions on Discord. /contributions/screen picks one design at random.",
    screens: [
      { path: "/contributions/screen/1", title: "Who thanked whom", about: "Everyone as a dot, each thank-you a line; the latest take turns." },
      { path: "/contributions/screen/2", title: "Thank-you wall", about: "Sticky notes for thank-yous, polaroids for contributions." },
    ],
  },
  {
    title: "Events we host",
    intro: "Each one's programme, shown on /screen on its days.",
    screens: hostedEvents.map((e) => ({ path: `${hostedEventPath(e)}/screen`, title: e.name, about: "The day's programme, what's on now and next." })),
  },
  {
    title: "The tablet",
    intro: "The community tablet by the door, in portrait.",
    screens: [{ path: "/tablet", title: "Sign up for a shift", about: "Upcoming events and shifts; sign up with a Discord name or an email.", portrait: true }],
  },
]

/** An index of every page made for the hub's screens, each with a live preview. */
export default function ScreensPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight">Screens</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Every page made for the screens at the Commons Hub. Click one to open it full screen.</p>
        {GROUPS.filter((g) => g.screens.length > 0).map((g) => (
          <div key={g.title} className="mt-14">
            <h2 className="text-2xl font-semibold">{g.title}</h2>
            {g.intro && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{g.intro}</p>}
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {g.screens.map((sc) => (
                <Link key={sc.path} href={sc.path} className="group block min-w-0" target="_blank">
                  <div className={sc.portrait ? "mx-auto max-w-[220px]" : ""}>
                    <ScreenPreview src={sc.path} width={sc.portrait ? 800 : 1920} height={sc.portrait ? 1280 : 1080} />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="font-semibold group-hover:text-primary">{sc.title}</span>
                    <code className="truncate text-xs text-muted-foreground">{sc.path}</code>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{sc.about}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
