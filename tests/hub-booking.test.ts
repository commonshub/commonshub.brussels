import { brusselsIso, icsFor, nextHalfHour, nowTimeInBrussels, todayInBrussels, whenText } from "@/lib/hub-booking"
import { pickFields } from "@/lib/token-bot"

describe("booking from the dashboard", () => {
  test("what a member types is Brussels time, summer and winter", () => {
    expect(brusselsIso("2026-07-01", "14:30")).toBe("2026-07-01T12:30:00.000Z")
    expect(brusselsIso("2026-12-01", "14:30")).toBe("2026-12-01T13:30:00.000Z")
    expect(brusselsIso("2026-10-25", "09:00")).toBe("2026-10-25T08:00:00.000Z") // the day winter time starts
  })

  test("today and now in Brussels", () => {
    const late = new Date("2026-10-26T23:30:00Z") // already the 27th in Brussels
    expect(todayInBrussels(0, late)).toBe("2026-10-27")
    expect(todayInBrussels(7, late)).toBe("2026-11-03")
    expect(nowTimeInBrussels(late)).toBe("00:30")
  })

  test("rooms start on the next half hour", () => {
    expect(nextHalfHour(0, new Date("2026-10-26T13:10:00Z"))).toBe("14:30")
    expect(nextHalfHour(0, new Date("2026-10-26T13:30:00Z"))).toBe("14:30")
    expect(nextHalfHour(60, new Date("2026-10-26T13:31:00Z"))).toBe("16:00")
    expect(nextHalfHour(60, new Date("2026-10-26T22:50:00Z"))).toBe("23:30")
  })

  test("when, in words", () => {
    expect(whenText("2026-10-26T13:30:00Z", "2026-10-26T15:00:00Z")).toBe("Mon 26 Oct, 14:30–16:00")
  })

  test("a calendar file for a booking, or an all-day one for coworking today", () => {
    const now = new Date("2026-10-26T10:00:00Z")
    const timed = icsFor({ title: "Workshop (Satoshi room)", start: "2026-10-26T13:30:00.000Z", end: "2026-10-26T15:00:00.000Z", location: "Rue de la Madeleine 51, 1000 Brussels" }, now)
    expect(timed).toContain("DTSTART:20261026T133000Z\r\nDTEND:20261026T150000Z")
    expect(timed).toContain("LOCATION:Rue de la Madeleine 51\\, 1000 Brussels")
    const allDay = icsFor({ title: "Coworking", start: "2026-10-26", end: "2026-10-26", allDay: true, location: "x" }, now)
    expect(allDay).toContain("DTSTART;VALUE=DATE:20261026\r\nDTEND;VALUE=DATE:20261027")
  })

  test("only the fields each action takes reach the bot; never a user id from the browser", () => {
    expect(pickFields("guestpass", { requestId: "r1", length: "day", userId: "123", guildId: "x", guestName: " Leo " })).toEqual({ requestId: "r1", length: "day", guestName: "Leo" })
    expect(pickFields("options", { userId: "123" })).toEqual({})
  })
})
