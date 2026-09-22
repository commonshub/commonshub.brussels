/**
 * The booking that pushed the day page sideways on a phone: the bot writes
 * the whole Discord message link into the calendar entry, and a URL is one
 * unbreakable word. Pinned here with the exact text as it arrived.
 */
import { describe, expect, test } from "@jest/globals"
import { buildDaySchedule } from "@/lib/day"

describe("a member sees the booking in full", () => {
  test("long link shortened, ticker in our own words", () => {
    const booking = {
      id: "b1",
      title: "Dean's booking",
      room: "angel",
      roomName: "Angel Room",
      start: new Date("2026-09-23T17:30:00+02:00"),
      end: new Date("2026-09-23T19:00:00+02:00"),
      description:
        "Booked by Dean (@dklearth) on Monday September 21st at 9:34pm for 1.50 CHT https://discord.com/channels/1280532848604086365/1354115945718878269/1551678021617066140",
      url: "",
    }
    const [item] = buildDaySchedule("2026-09-23", [booking as never], [], { isMember: true })
    expect(item.description).toBe("Booked by Dean (@dklearth) on Monday September 21st at 9:34pm for 1.50 tokens discord.com/channels/…")
    expect(item.description!.split(/\s+/).every((w) => w.length <= 28)).toBe(true)
  })
})
