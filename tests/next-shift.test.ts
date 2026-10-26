import { nextShiftOf } from "@/lib/next-shift"
import type { Shift } from "@/lib/shifts-service"

const shift = (id: string, start: string, end: string, who: Array<{ discordUserId: string; username: string }>): Shift => ({ id, start, end, signups: who.map((w) => ({ ...w, displayName: w.username })) })
const me = { discordId: "42", username: "xavier" }
const now = Date.parse("2026-10-26T12:00:00Z")

describe("nextShiftOf", () => {
  it("is the member's first shift that isn't over", () => {
    const shifts = [
      shift("later", "2026-10-30T09:00:00Z", "2026-10-30T13:00:00Z", [{ discordUserId: "42", username: "xavier" }]),
      shift("past", "2026-10-26T06:00:00Z", "2026-10-26T10:00:00Z", [{ discordUserId: "42", username: "xavier" }]),
      shift("other", "2026-10-27T09:00:00Z", "2026-10-27T13:00:00Z", [{ discordUserId: "7", username: "ana" }]),
      shift("now", "2026-10-26T11:00:00Z", "2026-10-26T14:00:00Z", [{ discordUserId: "", username: "xavier" }]),
    ]
    expect(nextShiftOf(shifts, me, now)?.id).toBe("now")
    expect(nextShiftOf(shifts.slice(0, 3), me, now)?.id).toBe("later")
  })
  it("is null without one", () => {
    expect(nextShiftOf([shift("other", "2026-10-27T09:00:00Z", "2026-10-27T13:00:00Z", [{ discordUserId: "7", username: "xavier" }])], me, now)).toBeNull()
  })
})
