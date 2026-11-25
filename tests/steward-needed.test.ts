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

test('"No steward needed" and the like say the opposite: not flagged', async () => {
  const { asksForSteward, declinesSteward } = await import("@/lib/tablet")
  for (const text of ["Contact Olivia\nNo steward needed, self organised", "Steward not needed", "stewards are not required", "No need for a steward", "without a steward needed"]) {
    expect(asksForSteward(text)).toBe(false)
    expect(declinesSteward(text)).toBe(true)
  }
  expect(declinesSteward("Steward needed")).toBe(false)
})
