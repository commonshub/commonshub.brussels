import { describe, expect, jest, test } from "@jest/globals"

import { isScreenRoute } from "@/lib/screen"
import { brusselsMs } from "@/lib/events-board-format"
import { buildDays, covered, joinSlot, uncovered, weekRange, mergeRooms, shiftFor, slotWindow } from "@/lib/tablet"

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
        { id: "b", title: "Climate contact", rooms: ["Mush Room"], startMs: at("2026-10-08T09:00:00+02:00"), endMs: at("2026-10-08T12:00:00+02:00") },
        { id: "a", title: "Yi-Jing", rooms: [], startMs: at("2026-10-07T17:00:00+02:00"), endMs: at("2026-10-07T19:00:00+02:00") },
        { id: "past", title: "Breakfast", rooms: [], startMs: at("2026-10-07T07:00:00+02:00"), endMs: at("2026-10-07T09:00:00+02:00") },
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

  test("one event booked in several rooms is one booking with all its rooms; different events stay apart", () => {
    const sunday = (id: string, title: string, room: string, from = "09:00", to = "21:30") => ({
      id,
      title,
      rooms: [room],
      startMs: at(`2026-10-18T${from}:00+02:00`),
      endMs: at(`2026-10-18T${to}:00+02:00`),
    })
    const merged = mergeRooms([
      sunday("1", "Sunday Gathering with Ani Rose", "Satoshi Room"),
      sunday("2", "Sunday Gathering with Ani Rose", "Angel Room", "10:00", "22:00"),
      sunday("3", "Sunday Gathering with Ani Rose", "Coworking Space"),
      sunday("4", "Mush Room booking", "Mush Room", "14:00", "16:00"),
    ])
    expect(merged.map((b) => [b.title, b.rooms, b.endMs])).toEqual([
      ["Sunday Gathering with Ani Rose", ["Angel Room", "Coworking Space", "Satoshi Room"], at("2026-10-18T22:00:00+02:00")],
      ["Mush Room booking", ["Mush Room"], at("2026-10-18T16:00:00+02:00")],
    ])
  })

  test("a booking is covered when someone is on shift all along; otherwise the first gap is what needs a steward", () => {
    const t = (hh: string) => at(`2026-10-18T${hh}:00+02:00`)
    const sunday = { startMs: t("09:00"), endMs: t("21:30") }
    expect(uncovered(sunday, [{ startMs: t("09:00"), endMs: t("13:00") }])).toEqual({ startMs: t("13:00"), endMs: t("21:30") })
    expect(uncovered(sunday, [{ startMs: t("12:00"), endMs: t("15:00") }])).toEqual({ startMs: t("09:00"), endMs: t("12:00") })
    expect(uncovered(sunday, [{ startMs: t("08:30"), endMs: t("13:00") }, { startMs: t("12:30"), endMs: t("17:00") }, { startMs: t("17:00"), endMs: t("22:00") }])).toBeNull()
    expect(covered(sunday, [{ startMs: t("08:30"), endMs: t("13:00") }])).toBe(false)
  })

  test("joining someone's shift takes the same time, on the half hour, one to four hours", () => {
    expect(joinSlot({ startMs: at("2026-10-08T14:00:00+02:00"), endMs: at("2026-10-08T17:00:00+02:00") })).toEqual({ start: 14 * 60, hours: 3 })
    expect(joinSlot({ startMs: at("2026-10-08T09:00:00+02:00"), endMs: at("2026-10-08T18:00:00+02:00") })).toEqual({ start: 9 * 60, hours: 4 })
  })

  test("a week at a time from today, four weeks back and seven ahead; past days keep what happened", () => {
    expect(weekRange(NOW, 0)).toMatchObject({ week: 0, first: "2026-10-07", fromMs: at("2026-10-07T00:00:00+02:00"), toMs: at("2026-10-14T00:00:00+02:00") })
    expect(weekRange(NOW, 1).first).toBe("2026-10-14")
    expect(weekRange(NOW, 3).toMs).toBe(at("2026-11-04T00:00:00+01:00"))
    expect(weekRange(NOW, -9)).toMatchObject({ week: -4, first: "2026-09-09" })
    expect(weekRange(NOW, 99).week).toBe(7)
    const last = buildDays(NOW, [{ id: "x", title: "Potluck", rooms: [], startMs: at("2026-10-02T12:30:00+02:00"), endMs: at("2026-10-02T13:30:00+02:00") }], [], 7, "2026-09-30")
    expect(last.map((d) => d.day)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"])
    expect(last[2].bookings.map((b) => b.title)).toEqual(["Potluck"])
  })

  test("a shift the tablet accepts: from today to eight weeks ahead, on the half hour from 7:00 to 22:00, one to four hours", () => {
    expect(slotWindow("2026-10-08", 9 * 60 + 30, 3, NOW)).toEqual({ startMs: at("2026-10-08T09:30:00+02:00"), endMs: at("2026-10-08T12:30:00+02:00") })
    expect(slotWindow("2026-11-30", 9 * 60, 1, NOW)).not.toBeNull()
    expect(slotWindow("2026-11-02", 13 * 60, 1, at("2026-10-27T10:00:00+01:00"))).toEqual({ startMs: at("2026-11-02T13:00:00+01:00"), endMs: at("2026-11-02T14:00:00+01:00") })
    for (const [day, start, hours] of [
      ["2026-10-08", 9 * 60 + 15, 3], // not on the half hour
      ["2026-10-08", 6 * 60, 3], // too early
      ["2026-10-08", 9 * 60, 9], // too long
      ["2026-10-06", 9 * 60, 3], // yesterday
      ["2026-12-02", 9 * 60, 3], // more than eight weeks ahead
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
  const booking = { id: "b", title: "Potluck", rooms: [], startMs: Date.parse(`${tomorrow}T12:30:00+02:00`), endMs: Date.parse(`${tomorrow}T13:30:00+02:00`) }
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
