import { describe, expect, test } from "@jest/globals"
import {
  buildDaySchedule,
  dayBounds,
  dayOf,
  parseDoorOpenings,
  peopleAtTheDoor,
  shiftDay,
  type DiscordMessageLike,
} from "@/lib/day"

const DAY = "2026-09-22"
const at = (hhmm: string, day = DAY) => new Date(`${day}T${hhmm}:00+02:00`)

const bookings = [
  { id: "b1", title: "Brusano Booking", description: "Lunch for 30, contact jane@example.com", start: at("08:30"), end: at("17:00"), roomId: "ostrom", roomName: "Ostrom Room" },
  { id: "b2", title: "Curiosity Talks", description: "<a href=\"https://luma.com/xh70cr0g\">luma</a>", url: "https://luma.com/xh70cr0g", start: at("17:30"), end: at("21:00"), roomId: "satoshi", roomName: "Satoshi Room" },
  { id: "b3", title: "Retreat", start: at("00:00", "2026-09-21"), end: at("23:59", "2026-09-23"), roomId: "angel", roomName: "Angel Room" },
  { id: "b4", title: "Tomorrow", start: at("10:00", "2026-09-23"), end: at("12:00", "2026-09-23"), roomId: "mushroom", roomName: "Mush Room" },
]
const publicEvents = [
  { id: "evt-1", name: "Curiosity Talks : Wellbeing and Music", startAt: "2026-09-22T17:30:00+02:00", endAt: "2026-09-22T20:00:00+02:00", url: "https://lu.ma/xh70cr0g", description: "<p>Talks</p>" },
  { id: "evt-2", name: "Potluck", startAt: "2026-09-25T12:00:00+02:00", url: "https://luma.com/5vz9qcwz" },
]

describe("day schedule", () => {
  test("a visitor sees public events in full and bookings as 'Booked'", () => {
    const items = buildDaySchedule(DAY, bookings, publicEvents, { isMember: false })
    expect(items.map((i) => [i.title, i.kind])).toEqual([
      ["Booked", "booking"], // retreat, all day, starts first
      ["Booked", "booking"], // Brusano
      ["Curiosity Talks : Wellbeing and Music", "public"],
    ])
    expect(items[1].description).toBeUndefined()
    expect(items[0].allDay).toBe(true)
    // The Google-calendar copy of the Luma event is folded into the Luma record.
    expect(items.filter((i) => /Curiosity/.test(i.title))).toHaveLength(1)
    expect(items[2].description).toBe("Talks")
  })

  test("a member sees the booking details, with contact details redacted", () => {
    const items = buildDaySchedule(DAY, bookings, publicEvents, { isMember: true })
    const brusano = items.find((i) => i.title === "Brusano Booking")!
    expect(brusano.kind).toBe("booking")
    expect(brusano.description).toBe("Lunch for 30, contact")
  })

  test("day bounds and arithmetic are Brussels-local", () => {
    const { start, end } = dayBounds("2026-03-29") // DST switch day
    expect(start.toISOString()).toBe("2026-03-28T23:00:00.000Z")
    expect(end.toISOString()).toBe("2026-03-29T21:59:59.999Z")
    expect(dayOf("2026-09-22T22:30:00Z")).toBe("2026-09-23")
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01")
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31")
  })
})

const door: DiscordMessageLike[] = [
  { id: "1", content: "Open", timestamp: "2026-09-22T09:05:49+02:00", author: { id: "100000000000000001", username: "dougpetrich", global_name: "Doug", avatar: "abc" } },
  { id: "2", content: "Good morning Doug! 🌞 (Members can open the door anytime)\n**Fun fact**: …", timestamp: "2026-09-22T09:05:50+02:00", author: { id: "bot", username: "door", bot: true } },
  { id: "3", content: "🚪 Door opened by <@100000000000000002> via shortcut 📲", timestamp: "2026-09-22T11:42:25+02:00", author: { id: "bot", username: "door", bot: true } },
  { id: "4", content: "Open", timestamp: "2026-09-22T12:17:49+02:00", author: { id: "100000000000000003", username: "bouday" } },
  { id: "5", content: "Good afternoon Cedric Sounard! 🌞 (Shifters can open the door anytime)", timestamp: "2026-09-22T12:17:49+02:00", author: { id: "bot", username: "door", bot: true } },
  { id: "6", content: "Open", timestamp: "2026-09-22T14:00:00+02:00", author: { id: "100000000000000001", username: "dougpetrich", global_name: "Doug" } },
  { id: "7", content: "Good afternoon Doug! 🌞", timestamp: "2026-09-22T14:00:01+02:00", author: { id: "bot", username: "door", bot: true } },
  { id: "8", content: "Good evening Someone Else!", timestamp: "2026-09-21T19:00:00+02:00", author: { id: "bot", username: "door", bot: true } },
]

describe("the door", () => {
  test("openings come from the bot's greetings and shortcut reports, for that day only", () => {
    const openings = parseDoorOpenings(door, DAY)
    expect(openings.map((o) => [o.name, o.via])).toEqual([
      ["Doug", "app"],
      ["Cedric Sounard", "app"],
      ["<@100000000000000002>", "shortcut"],
      ["Doug", "app"],
    ])
    expect(openings[0].userId).toBe("100000000000000001")
  })

  test("people are listed once, at the time they first came in, with their avatar", () => {
    const people = peopleAtTheDoor(parseDoorOpenings(door, DAY))
    expect(people.map((p) => [p.name, p.firstAt.slice(11, 16)])).toEqual([
      ["Doug", "09:05"],
      ["<@100000000000000002>", "11:42"],
      ["Cedric Sounard", "12:17"],
    ])
    expect(people[0].avatar).toBe("https://cdn.discordapp.com/avatars/100000000000000001/abc.png?size=128")
    expect(people[1].avatar).toBeUndefined()
  })
})
