/**
 * /events/screen: one-off events soonest first, weekly ones (Heartbeat,
 * park cleaning, potluck) shown once as recurring, the featured event we host,
 * and how days and "how soon" read in Brussels.
 */
import { describe, expect, jest, test } from "@jest/globals"

jest.mock("@/lib/image-proxy", () => ({ getProxiedImageUrl: (url: string) => `proxy:${url}` }))

const { boardEvents, brusselsMs, dayName, fromNow, isRecurring, nextFeatured, nextOccurrence, occurrences, RECURRING, weekGroup, whenLong } =
  require("@/lib/events-board") as typeof import("@/lib/events-board")

// Wednesday 7 October 2026, 10:00 in Brussels (08:00 UTC).
const NOW = Date.parse("2026-10-07T08:00:00Z")

describe("the weekly events", () => {
  test("Heartbeat on Mondays 13:00–14:00 (members only), park cleaning and potluck on Fridays", () => {
    expect(RECURRING.map((r) => [r.id, r.weekday, r.start, r.note ?? ""])).toEqual([
      ["heartbeat", 1, "13:00", "members only"],
      ["park-cleaning", 5, "12:00", ""],
      ["potluck", 5, "12:30", ""],
    ])
    expect(isRecurring("Open Community Potluck Lunch")).toBe(true)
    expect(isRecurring("Park cleaning with the neighbours")).toBe(true)
    expect(isRecurring("Building an AI Commons")).toBe(false)
  })

  test("their next time, in Brussels (summer time until 25 Oct)", () => {
    const potluck = RECURRING.find((r) => r.id === "potluck")!
    expect(new Date(nextOccurrence(potluck, NOW)).toISOString()).toBe("2026-10-09T10:30:00.000Z")
    const heartbeat = RECURRING.find((r) => r.id === "heartbeat")!
    expect(new Date(nextOccurrence(heartbeat, NOW)).toISOString()).toBe("2026-10-12T11:00:00.000Z")
    // On a Monday at 13:30, this Monday's is still on.
    expect(new Date(nextOccurrence(heartbeat, Date.parse("2026-10-12T11:30:00Z"))).toISOString()).toBe("2026-10-12T11:00:00.000Z")
    expect(occurrences(potluck, "2026-10-05", 14)).toEqual(["2026-10-09", "2026-10-16"])
    expect(brusselsMs("2026-11-02", "13:00")).toBe(Date.parse("2026-11-02T12:00:00Z")) // winter time
  })
})

describe("one-off events", () => {
  const ev = (id: string, name: string, startAt: string, endAt?: string) => ({ id, name, startAt, endAt })
  test("soonest first, not over, the weekly ones left out, each once", () => {
    const list = boardEvents(
      [
        ev("a", "Founders Running Club", "2026-10-10T07:30:00Z", "2026-10-10T09:00:00Z"),
        ev("b", "Open Community Potluck Lunch", "2026-10-09T10:30:00Z"),
        ev("c", "Yi-Jing", "2026-10-07T15:00:00Z", "2026-10-07T17:00:00Z"),
        ev("c", "Yi-Jing", "2026-10-07T15:00:00Z", "2026-10-07T17:00:00Z"),
        ev("d", "Yesterday", "2026-10-06T15:00:00Z", "2026-10-06T17:00:00Z"),
        ev("e", "Far away", "2027-03-01T15:00:00Z"),
      ],
      NOW,
    )
    expect(list.map((e) => e.id)).toEqual(["c", "a"])
  })

  test("the featured event: the next one we host that isn't over", () => {
    const hosted = [
      { slug: "ocd", name: "Open Commons Day", startAt: "2026-10-04T09:30:00+02:00", endAt: "2026-10-04T18:00:00+02:00", coverImage: "/a.png" },
      { slug: "osv", name: "Open Source Village 2027", tagline: "A pop-up village", startAt: "2027-01-25T09:00:00+01:00", endAt: "2027-02-05T18:00:00+01:00", coverImage: "/images/events/osv.png" },
    ] as unknown as Parameters<typeof nextFeatured>[0]
    expect(nextFeatured(hosted, NOW)).toMatchObject({ id: "hosted-osv", name: "Open Source Village 2027", featured: true, cover: "proxy:/images/events/osv.png" })
    expect(whenLong(nextFeatured(hosted, NOW)!, NOW)).toBe("25 Jan – 5 Feb")
  })
})

describe("when, in words", () => {
  test("today, tomorrow, a weekday; how soon; which week", () => {
    expect(dayName(Date.parse("2026-10-07T15:00:00Z"), NOW)).toBe("Today")
    expect(dayName(Date.parse("2026-10-08T15:00:00Z"), NOW)).toBe("Tomorrow")
    expect(dayName(Date.parse("2026-10-10T07:30:00Z"), NOW)).toBe("Sat 10 Oct")
    expect(fromNow(Date.parse("2026-10-07T08:30:00Z"), NOW)).toBe("in 30 min")
    expect(fromNow(Date.parse("2026-10-08T05:00:00Z"), NOW)).toBe("in 21 hours")
    expect(fromNow(Date.parse("2026-10-11T10:00:00Z"), NOW)).toBe("in 4 days")
    expect(fromNow(Date.parse("2026-11-01T10:00:00Z"), NOW)).toBe("in 4 weeks")
    expect(fromNow(Date.parse("2027-01-25T08:00:00Z"), NOW)).toBe("in 4 months")
    expect(weekGroup(Date.parse("2026-10-11T10:00:00Z"), NOW)).toBe("this week")
    expect(weekGroup(Date.parse("2026-10-12T10:00:00Z"), NOW)).toBe("next week")
    expect(weekGroup(Date.parse("2026-10-19T10:00:00Z"), NOW)).toBe("later")
  })
})
