import { describe, expect, test } from "@jest/globals"

import { getHostedEvent, type HostedEvent } from "@/lib/hosted-events"
import {
  buildProgramme,
  parsePreviewTime,
  programmeDate,
  screenTournament,
  slotStatuses,
  visibleWindow,
} from "@/lib/programme-screen"
import { isScreenRoute } from "@/lib/screen"

const ocd = getHostedEvent("ocd-2026") as HostedEvent
/** An instant on the day of Open Commons Day, Brussels time (CEST). */
const at = (time: string) => Date.parse(`2026-10-04T${time}:00+02:00`)

describe("screen routes", () => {
  test("pages ending in /screen are the TV's, with no site header or footer", () => {
    expect(isScreenRoute("/events/ocd-2026/screen")).toBe(true)
    expect(isScreenRoute("/contribute/screen")).toBe(true)
    expect(isScreenRoute("/contribute/screen/")).toBe(true)
    expect(isScreenRoute("/contributions/screen/2")).toBe(true)
    expect(isScreenRoute("/contribute")).toBe(false)
    expect(isScreenRoute("/events/screening-night")).toBe(false)
    expect(isScreenRoute(null)).toBe(false)
  })
})

describe("the OCD programme on screen", () => {
  const programme = buildProgramme(ocd, at("12:30"))!

  test("reads the event's own sessions: one slot per start time, each ending when the next starts", () => {
    expect(programme.date).toBe("2026-10-04")
    expect(programme.slots.map((s) => s.start)).toEqual(["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"])
    expect(programme.slots.map((s) => s.end)).toEqual(["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"])
    expect(programme.slots.reduce((n, s) => n + s.sessions.length, 0)).toBe(ocd.sessions.length)
  })

  test("rooms get their names and keep the order of rooms.json", () => {
    const at13 = programme.slots.find((s) => s.start === "13:00")!
    expect(at13.sessions.map((s) => s.roomName)).toEqual(["Satoshi Room", "Angel Room", "Mush Room"])
  })

  test("over, now, next, later", () => {
    expect(slotStatuses(programme.slots, at("12:30"))).toEqual(["past", "now", "next", "later", "later", "later", "later"])
    // On the hour, the slot that starts is now and the one before is over.
    expect(slotStatuses(programme.slots, at("13:00")).slice(1, 4)).toEqual(["past", "now", "next"])
    expect(slotStatuses(programme.slots, at("09:45"))).toEqual(["next", "later", "later", "later", "later", "later", "later"])
    expect(slotStatuses(programme.slots, at("18:30")).every((s) => s === "past")).toBe(true)
  })

  test("the window starts at what is on now and stops moving at the end of the day", () => {
    const window = (time: string) => visibleWindow(programme.slots, at(time), 4)
    expect(window("09:45")).toEqual({ from: 0, to: 4 })
    expect(window("11:30")).toEqual({ from: 0, to: 4 })
    expect(window("12:30")).toEqual({ from: 1, to: 5 })
    expect(window("14:20")).toEqual({ from: 3, to: 7 })
    expect(window("16:50")).toEqual({ from: 3, to: 7 })
    expect(window("23:00")).toEqual({ from: 3, to: 7 })
    expect(visibleWindow(programme.slots.slice(0, 2), at("12:30"), 4)).toEqual({ from: 0, to: 2 })
  })

  test("the kicker tournament, with its instants", () => {
    const tournament = screenTournament(ocd)!
    expect(tournament.startMs).toBe(at("15:00"))
    expect(tournament.endMs).toBe(at("18:00"))
  })

  test("?at= previews a time, local to the event unless it says otherwise", () => {
    expect(parsePreviewTime("2026-10-04T14:20", ocd)).toBe(at("14:20"))
    expect(parsePreviewTime("2026-10-04T12:20Z", ocd)).toBe(at("14:20"))
    expect(parsePreviewTime("tomorrow", ocd)).toBeNull()
    expect(parsePreviewTime(undefined, ocd)).toBeNull()
  })
})

describe("events over several days", () => {
  const event: HostedEvent = {
    ...ocd,
    startAt: "2027-05-01T10:00:00+02:00",
    endAt: "2027-05-02T20:00:00+02:00",
    tournament: undefined,
    sessions: [
      { date: "2027-05-01", start: "10:00", room: "ostrom", title: "Day one" },
      { date: "2027-05-02", start: "10:00", room: "ostrom", title: "Day two, first" },
      { date: "2027-05-02", start: "18:30", end: "19:15", room: "ostrom", title: "Day two, last" },
    ],
  }

  test("shows today, else the next day with sessions, else the last day", () => {
    expect(programmeDate(event, Date.parse("2027-04-20T12:00:00+02:00"))).toBe("2027-05-01")
    expect(programmeDate(event, Date.parse("2027-05-02T08:00:00+02:00"))).toBe("2027-05-02")
    expect(programmeDate(event, Date.parse("2027-06-01T12:00:00+02:00"))).toBe("2027-05-02")
  })

  test("the day's last slot runs until the event ends that day", () => {
    const day2 = buildProgramme(event, Date.parse("2027-05-02T09:00:00+02:00"))!
    expect(day2.slots.map((s) => s.sessions[0].title)).toEqual(["Day two, first", "Day two, last"])
    expect(day2.slots[1].end).toBe("20:00")
    const day1 = buildProgramme(event, Date.parse("2027-05-01T09:00:00+02:00"))!
    // The event does not end on day one: an hour, like any last slot.
    expect(day1.slots[0].end).toBe("11:00")
  })
})
