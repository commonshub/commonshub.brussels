import { describe, expect, test } from "@jest/globals"
import { dayLabel, timeRange, upcomingScreenEvents } from "@/lib/events-screen"

const ev = (id: string, startAt: string, endAt?: string) => ({ id, name: `Event ${id}`, startAt, endAt })

describe("/events/screen", () => {
  const now = Date.parse("2026-10-05T10:00:00+02:00")

  test("still to come or happening now, soonest first, each once, at most the limit", () => {
    const events = [
      ev("later", "2026-10-09T12:30:00+02:00", "2026-10-09T13:30:00+02:00"),
      ev("over", "2026-10-05T08:00:00+02:00", "2026-10-05T09:00:00+02:00"),
      ev("now", "2026-10-05T09:30:00+02:00", "2026-10-05T11:00:00+02:00"),
      ev("soon", "2026-10-06T17:00:00+02:00"),
      ev("soon", "2026-10-06T17:00:00+02:00"),
    ]
    expect(upcomingScreenEvents(events, now).map((e) => e.id)).toEqual(["now", "soon", "later"])
    expect(upcomingScreenEvents(events, now, 2).map((e) => e.id)).toEqual(["now", "soon"])
    // No end: two hours.
    expect(upcomingScreenEvents(events, now)[1].endMs - upcomingScreenEvents(events, now)[1].startMs).toBe(2 * 3_600_000)
  })

  test("today, tomorrow, then the date; the time range in Brussels", () => {
    expect(dayLabel(Date.parse("2026-10-05T19:00:00+02:00"), now)).toBe("Today")
    expect(dayLabel(Date.parse("2026-10-06T09:00:00+02:00"), now)).toBe("Tomorrow")
    expect(dayLabel(Date.parse("2026-10-09T12:30:00+02:00"), now)).toBe("Fri 9 Oct")
    expect(timeRange(Date.parse("2026-10-07T17:00:00+02:00"), Date.parse("2026-10-07T19:00:00+02:00"))).toBe("17:00–19:00")
  })
})
