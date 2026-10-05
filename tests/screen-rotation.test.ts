import { describe, expect, test } from "@jest/globals"
import { screenSlides, todaysEvents } from "@/lib/screen-rotation"

const event = (slug: string, startAt: string, dates: string[]) =>
  ({ slug, startAt, timezone: "Europe/Brussels", sessions: dates.map((date) => ({ date })) }) as never

const ocd = event("ocd-2026", "2026-10-04T10:00:00+02:00", ["2026-10-04"])
const fest = event("fest", "2026-10-10T10:00:00+02:00", ["2026-10-10", "2026-10-11"])

describe("/screen rotation", () => {
  test("today's events come first and stay twice as long", () => {
    const slides = screenSlides(Date.parse("2026-10-04T08:00:00Z"), 30, [ocd, fest])
    expect(slides).toEqual([
      { path: "/events/ocd-2026/screen", seconds: 60 },
      { path: "/events/screen", seconds: 30 },
      { path: "/members/screen", seconds: 30 },
      { path: "/contribute/screen", seconds: 30 },
    ])
  })

  test("no event today: upcoming events, members and contribute only; multi-day events count on each day", () => {
    expect(screenSlides(Date.parse("2026-10-05T08:00:00Z"), 30, [ocd, fest]).map((s) => s.path)).toEqual(["/events/screen", "/members/screen", "/contribute/screen"])
    expect(todaysEvents(Date.parse("2026-10-11T09:00:00Z"), [ocd, fest]).map((e: { slug: string }) => e.slug)).toEqual(["fest"])
  })

  test("the day is the event's local day (late evening UTC is already tomorrow in Brussels)", () => {
    expect(todaysEvents(Date.parse("2026-10-03T22:30:00Z"), [ocd]).length).toBe(1)
  })
})
