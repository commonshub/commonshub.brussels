import { describe, expect, test } from "@jest/globals"

import { buildShiftDm } from "@/lib/shift-email"

const base = {
  memberName: "Miriam",
  start: new Date("2026-10-14T11:30:00Z"),
  end: new Date("2026-10-14T14:30:00Z"),
  timezone: "Europe/Brussels",
  reward: { amount: 3, symbol: "tokens" },
  via: "tablet",
} as any

describe("the Discord DM confirming a shift", () => {
  test("the door, handbook and cancel links are buttons, not spelled out", () => {
    const door = `https://door.commonshub.brussels/open?name=Miriam&sig=0x${"ab".repeat(65)}`
    const cancel = `https://commonshub.brussels/shifts/cancel?t=${"x".repeat(200)}`
    const dm = buildShiftDm({ ...base, eventTitle: "Option Valia", doorLink: door, cancelUrl: cancel })
    expect(dm.buttons.map((b) => [b.label, b.url])).toEqual([
      ["Open the door", door],
      ["Handbook", "https://commonshub.brussels/handbook"],
      ["Cancel", cancel],
    ])
    expect(dm.content).not.toContain("https://")
    expect(dm.content).toContain("You steward: **Option Valia**")
  })

  test("a link too long for a button stays in the text, masked", () => {
    const door = `https://door.commonshub.brussels/open?${"a".repeat(600)}`
    const dm = buildShiftDm({ ...base, doorLink: door })
    expect(dm.buttons.map((b) => b.label)).toEqual(["Handbook"])
    expect(dm.content).toContain(`[Open the door](<${door}>)`)
  })
})
