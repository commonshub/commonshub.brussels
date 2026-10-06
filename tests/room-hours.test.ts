import { describe, expect, test } from "@jest/globals"

import { bookableFromHour, bookableFromLabel } from "@/lib/room-hours"
import roomsData from "@/settings/rooms.json"

describe("rooms bookable only from a given hour", () => {
  test("labels and hours", () => {
    expect(bookableFromHour("19:00")).toBe(19)
    expect(bookableFromLabel("19:00")).toBe("from 7pm")
    expect(bookableFromLabel("09:30")).toBe("from 9am")
    expect(bookableFromHour(undefined)).toBe(0)
    expect(bookableFromLabel(null)).toBe("")
  })

  test("prices match the Discord bot's /book (Oct 2026): coworking after 7pm only", () => {
    const by = Object.fromEntries(roomsData.rooms.map((r) => [r.id, r]))
    expect(by.coworking).toMatchObject({ pricePerHour: 50, tokensPerHour: 2, bookableFrom: "19:00" })
    expect(by.satoshi).toMatchObject({ pricePerHour: 60, tokensPerHour: 2 })
    expect(by.phonebooth).toMatchObject({ pricePerHour: 10, tokensPerHour: 0.5 })
    expect(by.ostrom).toMatchObject({ pricePerHour: 130, tokensPerHour: 3 })
  })
})
