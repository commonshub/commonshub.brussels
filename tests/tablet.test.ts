import { describe, expect, jest, test } from "@jest/globals"

import { isScreenRoute } from "@/lib/screen"
import { brusselsMs } from "@/lib/events-board-format"
import { buildDays, covered, shiftFor, slotWindow } from "@/lib/tablet"

const H = 3_600_000
const at = (iso: string) => Date.parse(iso)
const shift = (start: string, end: string, people: Array<[string, string]>) => ({
  id: `${start}-${end}`,
  start,
  end,
  signups: people.map(([id, name]) => ({ discordUserId: id, username: name.toLowerCase(), displayName: name })),
})

// Wednesday 7 October 2026, 10:00 in Brussels.
const NOW = at("2026-10-07T10:00:00+02:00")

describe("the community tablet", () => {
  test("is a full-screen route, like the screens", () => {
    expect(isScreenRoute("/tablet")).toBe(true)
    expect(isScreenRoute("/tablets")).toBe(false)
    expect(isScreenRoute("/contribute/screen")).toBe(true)
  })

  test("a calendar of the coming days: each with its bookings and shifts, earliest first; what is over is left out", () => {
    const days = buildDays(
      NOW,
      [
        { id: "b", title: "Climate contact", room: "Mush Room", startMs: at("2026-10-08T09:00:00+02:00"), endMs: at("2026-10-08T12:00:00+02:00") },
        { id: "a", title: "Yi-Jing", startMs: at("2026-10-07T17:00:00+02:00"), endMs: at("2026-10-07T19:00:00+02:00") },
        { id: "past", title: "Breakfast", startMs: at("2026-10-07T07:00:00+02:00"), endMs: at("2026-10-07T09:00:00+02:00") },
      ],
      [shift("2026-10-07T16:30:00+02:00", "2026-10-07T19:30:00+02:00", [["1", "Leen"]]), shift("2026-10-07T08:00:00+02:00", "2026-10-07T09:00:00+02:00", [["2", "Early"]])],
      3,
    )
    expect(days.map((d) => d.day)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"])
    expect(days[0].bookings.map((b) => b.id)).toEqual(["a"])
    expect(days[0].shifts.map((s) => s.people.map((p) => p.name))).toEqual([["Leen"]])
    expect(covered(days[0].bookings[0], days[0].shifts)).toBe(true)
    expect(covered(days[1].bookings[0], days[1].shifts)).toBe(false)
  })

  test("a shift the tablet accepts: the coming two weeks, on the half hour from 7:00 to 22:00, one to four hours", () => {
    expect(slotWindow("2026-10-08", 9 * 60 + 30, 3, NOW)).toEqual({ startMs: at("2026-10-08T09:30:00+02:00"), endMs: at("2026-10-08T12:30:00+02:00") })
    expect(slotWindow("2026-11-02", 13 * 60, 1, at("2026-10-27T10:00:00+01:00"))).toEqual({ startMs: at("2026-11-02T13:00:00+01:00"), endMs: at("2026-11-02T14:00:00+01:00") })
    for (const [day, start, hours] of [
      ["2026-10-08", 9 * 60 + 15, 3], // not on the half hour
      ["2026-10-08", 6 * 60, 3], // too early
      ["2026-10-08", 9 * 60, 9], // too long
      ["2026-10-06", 9 * 60, 3], // yesterday
      ["2026-10-30", 9 * 60, 3], // more than two weeks ahead
      ["8 Oct", 9 * 60, 3],
    ] as const) {
      expect(slotWindow(day, start, hours, NOW)).toBeNull()
    }
  })

  test("the shift for a booking starts half an hour before it and covers it, four hours at most", () => {
    expect(shiftFor({ startMs: at("2026-10-08T09:00:00+02:00"), endMs: at("2026-10-08T12:00:00+02:00") })).toEqual({ start: 8 * 60 + 30, hours: 4 })
    expect(shiftFor({ startMs: at("2026-10-08T17:00:00+02:00"), endMs: at("2026-10-08T18:00:00+02:00") })).toEqual({ start: 16 * 60 + 30, hours: 2 })
    expect(shiftFor({ startMs: at("2026-10-08T09:00:00+02:00"), endMs: at("2026-10-08T18:00:00+02:00") }).hours).toBe(4)
  })
})

describe("signing up from the tablet", () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })
  const booking = { id: "b", title: "Potluck", startMs: Date.parse(`${tomorrow}T12:30:00+02:00`), endMs: Date.parse(`${tomorrow}T13:30:00+02:00`) }
  const signUp = jest.fn(async (person: object, start: Date, end: Date, eventTitle?: string) => ({
    dmSent: true,
    emailed: false,
    cancelUrl: "x",
    shift: { id: "s", start: start.toISOString(), end: end.toISOString(), summary: eventTitle, signups: [] },
  }))

  async function post(body: object) {
    let res!: Response
    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/lib/tablet-data", () => ({ loadTabletBookings: () => [booking] }))
      jest.doMock("@/lib/shifts-service", () => ({
        ShiftError: class extends Error {},
        isShiftsConfigured: () => true,
        signUp,
      }))
      jest.doMock("@/lib/discord", () => ({
        discordGet: async (path: string) =>
          path.endsWith("/618897639836090398")
            ? new Response(JSON.stringify({ nick: null, user: { id: "618897639836090398", username: "leen8610", global_name: "Leen" } }))
            : new Response("{}", { status: 404 }),
      }))
      const { POST } = await import("@/app/api/tablet/signup/route")
      res = await POST(new Request("http://localhost/api/tablet/signup", { method: "POST", body: JSON.stringify(body) }))
    })
    return res
  }

  test("the shift's times come from the day, start and length, and it is named after what it stewards", async () => {
    const res = await post({ day: tomorrow, start: 12 * 60, hours: 2, discordUserId: "618897639836090398", startMs: 0 })
    expect(res.status).toBe(200)
    const [person, start, end, title] = signUp.mock.calls.at(-1)!
    expect(person).toEqual({ kind: "discord", id: "618897639836090398", username: "leen8610", displayName: "Leen" })
    expect(start.getTime()).toBe(brusselsMs(tomorrow, "12:00"))
    expect(end.getTime() - start.getTime()).toBe(2 * H)
    expect(title).toBe("Potluck")
  })

  test("a shift that stewards no booking stewards the hub", async () => {
    await post({ day: tomorrow, start: 8 * 60, hours: 2, discordUserId: "618897639836090398" })
    expect(signUp.mock.calls.at(-1)![3]).toBe("Stewarding the hub")
  })

  test("someone without Discord signs up with an email address and a name", async () => {
    const res = await post({ day: tomorrow, start: 9 * 60, hours: 1, email: " Ann@Example.org ", name: "Ann" })
    expect(res.status).toBe(200)
    expect(signUp.mock.calls.at(-1)![0]).toEqual({ kind: "email", email: "ann@example.org", displayName: "Ann" })
  })

  test("refuses a day or time the tablet does not offer, an unknown or malformed Discord id, a bad email", async () => {
    for (const body of [
      { day: "2020-01-01", start: 600, hours: 3, discordUserId: "618897639836090398" },
      { day: tomorrow, start: 615, hours: 3, discordUserId: "618897639836090398" },
      { day: tomorrow, start: 600, hours: 9, discordUserId: "618897639836090398" },
      { day: tomorrow, start: 600, hours: 3, discordUserId: "<@everyone>" },
      { day: tomorrow, start: 600, hours: 3, discordUserId: "999999999999999999" }, // not on the server
      { day: tomorrow, start: 600, hours: 3, email: "not-an-email" },
    ]) {
      expect((await post(body)).status).toBe(400)
    }
  })
})
