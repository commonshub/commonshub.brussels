import { parsePass, passCost, passState, DOOR_OPEN_URL, PASS_DISCLAIMER } from "@/lib/guest-pass"

// A half-day pass signed by token-bot for 9:00–14:00 Brussels time: signed 9:30, 240 minutes.
const start = Date.parse("2026-10-23T07:30:00Z") / 1000
const fragment = "#" + new URLSearchParams({
  name: "Leo (Xavier's guest)",
  host: "Xavier",
  reason: "a guest pass (9am-2pm)",
  timestamp: "1792000000",
  startTime: String(start),
  duration: "240",
  booking: "1",
  sig: "0xabc",
  pass: "half-day",
}).toString()

describe("guest pass page", () => {
  it("reads the pass from the fragment and opens exactly the signed door link", () => {
    const p = parsePass(fragment)!
    expect(p.guest).toBe("Leo (Xavier's guest)")
    expect(p.host).toBe("Xavier")
    expect(p.length).toBe("half-day")
    expect(p.from.toISOString()).toBe("2026-10-23T07:00:00.000Z")
    expect(p.until.toISOString()).toBe("2026-10-23T12:00:00.000Z")
    const door = new URL(p.doorUrl)
    expect(`${door.origin}${door.pathname}`).toBe(DOOR_OPEN_URL)
    expect(door.searchParams.get("sig")).toBe("0xabc")
    expect(door.searchParams.get("booking")).toBe("1")
    expect(door.searchParams.has("pass")).toBe(false) // not part of the signed link
  })

  it("is upcoming, active, then expired", () => {
    const p = parsePass(fragment)!
    expect(passState(p, new Date("2026-10-23T06:59:00Z"))).toBe("upcoming")
    expect(passState(p, new Date("2026-10-23T07:00:00Z"))).toBe("active")
    expect(passState(p, new Date("2026-10-23T12:00:00Z"))).toBe("active")
    expect(passState(p, new Date("2026-10-23T12:01:00Z"))).toBe("expired")
  })

  it("an incomplete link is not a pass", () => {
    expect(parsePass("")).toBeNull()
    expect(parsePass(fragment.replace(/&sig=[^&]+/, ""))).toBeNull()
  })

  it("shows the cost in euros (+ VAT, as on /coworking) and in tokens, and the plain-language fine print", () => {
    expect(passCost("day")).toBe("Full day: €25 (+ VAT) or 2 tokens")
    expect(passCost("half-day")).toBe("Half day: €15 (+ VAT) or 1 token")
    expect(PASS_DISCLAIMER).toContain("Too Good To Go")
    expect(PASS_DISCLAIMER).toContain("not payment for a service")
  })
})
