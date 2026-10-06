import { describe, expect, jest, test } from "@jest/globals"

import { isScreenRoute } from "@/lib/screen"
import { defaultShift, shiftWindow, signupsFor, withShifts } from "@/lib/tablet"

const H = 3_600_000
const at = (iso: string) => Date.parse(iso)
const shift = (start: string, end: string, people: Array<[string, string]>) => ({
  id: `${start}-${end}`,
  start,
  end,
  signups: people.map(([id, name]) => ({ discordUserId: id, username: name.toLowerCase(), displayName: name })),
})

describe("the community tablet", () => {
  test("is a full-screen route, like the screens", () => {
    expect(isScreenRoute("/tablet")).toBe(true)
    expect(isScreenRoute("/tablets")).toBe(false)
    expect(isScreenRoute("/contribute/screen")).toBe(true)
  })

  test("the default shift starts 30 minutes before the event and lasts 3 hours", () => {
    const start = at("2026-10-07T17:00:00+02:00")
    expect(defaultShift(start)).toEqual({ startMs: start - 30 * 60_000, endMs: start - 30 * 60_000 + 3 * H })
  })

  test("only the offered starts and lengths are accepted", () => {
    const start = at("2026-10-07T17:00:00+02:00")
    expect(shiftWindow(start, -30, 1)).toEqual({ startMs: start - 30 * 60_000, endMs: start + 30 * 60_000 })
    expect(shiftWindow(start, -45, 3)).toBeNull()
    expect(shiftWindow(start, -30, 12)).toBeNull()
  })

  test("who is on shift around an event: overlapping shifts, each person once, earliest first", () => {
    const event = { startMs: at("2026-10-07T17:00:00+02:00"), endMs: at("2026-10-07T19:00:00+02:00") }
    const shifts = [
      shift("2026-10-07T16:30:00+02:00", "2026-10-07T19:30:00+02:00", [["1", "Leen"]]),
      shift("2026-10-07T18:00:00+02:00", "2026-10-07T19:00:00+02:00", [["2", "Xavier"], ["1", "Leen"]]),
      shift("2026-10-07T09:00:00+02:00", "2026-10-07T12:00:00+02:00", [["3", "Morning"]]), // another time of day
      shift("2026-10-07T19:00:00+02:00", "2026-10-07T21:00:00+02:00", [["4", "After"]]), // starts when the event ends
    ]
    const people = signupsFor(event, shifts)
    expect(people.map((p) => p.displayName)).toEqual(["Leen", "Xavier"])
    expect(people[0].startMs).toBe(at("2026-10-07T16:30:00+02:00"))
    expect(withShifts([{ id: "e", name: "Talk", cover: "", ...event }], shifts)[0].signups).toHaveLength(2)
  })
})

describe("signing up from the tablet", () => {
  const event = { id: "evt-1", name: "Potluck", startMs: Date.now() + 2 * 86_400_000, endMs: Date.now() + 2 * 86_400_000 + H, cover: "" }
  const signUp = jest.fn(async (input: { discordUserId: string; start: Date; end: Date; eventTitle?: string }) => ({
    ok: true,
    emailed: true,
    shift: { id: "s", start: input.start.toISOString(), end: input.end.toISOString(), signups: [] },
  }))

  async function post(body: object) {
    let res!: Response
    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/lib/tablet-data", () => ({ loadTabletEvents: async () => [event] }))
      jest.doMock("@/lib/token-bot", () => ({
        ...(jest.requireActual("@/lib/token-bot") as object),
        isTokenBotConfigured: () => true,
        signUpForShift: signUp,
      }))
      const { POST } = await import("@/app/api/tablet/signup/route")
      res = await POST(new Request("http://localhost/api/tablet/signup", { method: "POST", body: JSON.stringify(body) }))
    })
    return res
  }

  test("the shift's times come from the event and the chosen start and length, not from the browser", async () => {
    const res = await post({ eventId: "evt-1", discordUserId: "618897639836090398", startOffset: -30, hours: 2, start: "1999-01-01" })
    expect(res.status).toBe(200)
    const call = signUp.mock.calls.at(-1)![0]
    expect(call.start.getTime()).toBe(event.startMs - 30 * 60_000)
    expect(call.end.getTime()).toBe(event.startMs - 30 * 60_000 + 2 * H)
    expect(call.eventTitle).toBe("Potluck")
  })

  test("refuses an unknown event, a start or length the tablet does not offer, or a malformed Discord id", async () => {
    for (const body of [
      { eventId: "nope", discordUserId: "618897639836090398", startOffset: -30, hours: 3 },
      { eventId: "evt-1", discordUserId: "618897639836090398", startOffset: -45, hours: 3 },
      { eventId: "evt-1", discordUserId: "618897639836090398", startOffset: -30, hours: 9 },
      { eventId: "evt-1", discordUserId: "<@everyone>", startOffset: -30, hours: 3 },
    ]) {
      expect((await post(body)).status).toBe(400)
    }
  })
})
