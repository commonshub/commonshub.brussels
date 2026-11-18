import { asksForSteward, mergeRooms, type TabletBooking } from "@/lib/tablet"

test('"Steward needed" / "Stewards needed", any case, flags an event', () => {
  expect(asksForSteward("Workshop. Steward needed from 18:00")).toBe(true)
  expect(asksForSteward("STEWARDS NEEDED")).toBe(true)
  expect(asksForSteward("two stewards  needed for setup")).toBe(true)
  expect(asksForSteward("no steward is needed")).toBe(false)
  expect(asksForSteward(undefined)).toBe(false)
})

test("merged rooms keep the flag", () => {
  const b = (room: string, stewardNeeded?: boolean): TabletBooking => ({ id: room, title: "Gathering", rooms: [room], startMs: 1_000, endMs: 5_000, ...(stewardNeeded ? { stewardNeeded } : {}) })
  expect(mergeRooms([b("Ostrom"), b("Satoshi", true)])).toMatchObject([{ rooms: ["Ostrom", "Satoshi"], stewardNeeded: true }])
})

test("a booking's own description (members tier) can ask for a steward too", async () => {
  const { asksForSteward } = await import("@/lib/tablet")
  expect(asksForSteward("Birthday party\nSteward needed for opening at 18:00")).toBe(true)
})
