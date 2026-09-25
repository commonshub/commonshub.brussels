import { describe, expect, test } from "@jest/globals"
import { formatEventWhen } from "@/lib/event-dates"

const now = new Date("2026-09-25T10:00:00Z")

describe("when an event happens, in words", () => {
  test("one day: weekday, date and hours, in Brussels time", () => {
    expect(formatEventWhen("2026-10-04T09:30:00+02:00", "2026-10-04T18:00:00+02:00", now)).toBe("Sunday 4 October · 09:30–18:00")
    expect(formatEventWhen("2026-10-01T16:00:00Z", undefined, now)).toBe("Thursday 1 October · 18:00")
  })

  test("several days: a range, with the year once it is not this one", () => {
    expect(formatEventWhen("2027-01-25T09:00:00+01:00", "2027-02-05T18:00:00+01:00", now)).toBe("25 January – 5 February 2027")
    expect(formatEventWhen("2026-12-30T09:00:00+01:00", "2027-01-02T18:00:00+01:00", now)).toBe("30 December 2026 – 2 January 2027")
    expect(formatEventWhen("2026-11-02T09:00:00+01:00", "2026-11-03T18:00:00+01:00", now)).toBe("2 November – 3 November")
  })

  test("a single day next year shows the year; a bad date shows nothing", () => {
    expect(formatEventWhen("2027-03-06T10:00:00+01:00", "2027-03-06T12:00:00+01:00", now)).toBe("Saturday 6 March 2027 · 10:00–12:00")
    expect(formatEventWhen("not a date", undefined, now)).toBe("")
  })
})
