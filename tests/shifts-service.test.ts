import { describe, expect, jest, test } from "@jest/globals"

// The relays and the door are not what these tests are about (and their libraries are ES modules).
jest.mock("@/lib/nostr-server", () => ({ COMMUNITY: {}, coordinatorPubkey: () => null, publishAsSite: async () => null, siteIdentity: () => null }))
jest.mock("@/lib/nostr-conventions", () => ({ buildRsvp: () => ({}) }))
jest.mock("@/lib/door-link", () => ({ buildDoorLink: async () => null }))
/* eslint-disable @typescript-eslint/no-require-imports */
const { auditTimestamp, cancelLine, parseSignups, signCancel, signupLine, verifyCancel } = require("@/lib/shifts-service") as typeof import("@/lib/shifts-service")
const { buildShiftEmail, buildShiftIcs } = require("@/lib/shift-email") as typeof import("@/lib/shift-email")
/* eslint-enable @typescript-eslint/no-require-imports */


/** The Discord bot's parser (opencollective/token-bot parseShiftSignups), which the token claims rely on. */
function botParse(description: string) {
  const signups: Array<{ discordUserId: string; username: string }> = []
  const cancelled = new Set<string>()
  for (const line of description.split("\n")) {
    const signup = line.match(/<@(\S+?)> signed up(?: \(discord:(\d+)\))?/)
    if (signup) {
      signups.push({ discordUserId: signup[2] || "", username: signup[1] })
      continue
    }
    const cancel = line.match(/<@(\S+?)> cancelled/)
    if (cancel) cancelled.add(cancel[1])
  }
  return signups.filter((s) => !cancelled.has(s.username))
}

const now = new Date("2026-10-06T12:05:00Z")
const leen = { kind: "discord" as const, id: "618897639836090398", username: "leen8610", displayName: "Leen" }
const ann = { kind: "email" as const, email: "ann@example.org", displayName: "Ann" }

describe("the calendar's audit lines", () => {
  test("a tablet sign-up reads exactly like a /shifts one for the bot (the Discord id right after 'signed up')", () => {
    const line = signupLine(leen, "Potluck", now)
    expect(line).toBe("06/10/2026 14:05: Leen <@leen8610> signed up (discord:618897639836090398) via the community tablet to steward Potluck")
    expect(botParse(line)).toEqual([{ discordUserId: "618897639836090398", username: "leen8610" }])
  })

  test("someone signed up by email is invisible to the bot, so its reward flow never mints for an empty Discord id", () => {
    const line = signupLine(ann, undefined, now)
    expect(line).toBe("06/10/2026 14:05: Ann (email:ann@example.org) signed up via the community tablet")
    expect(botParse(line)).toEqual([])
    expect(botParse(cancelLine({ displayName: "Ann", handle: "email:ann@example.org" }, now))).toEqual([])
  })

  test("sign-ups still standing: bot lines, tablet lines, cancellations", () => {
    const description = [
      "05/10/2026 10:00: Xavier <@xdamman> signed up (discord:689614876515237925)",
      signupLine(leen, "Potluck", now),
      signupLine(ann, undefined, now),
      cancelLine({ displayName: "Xavier", handle: "xdamman" }, now),
    ].join("\n")
    expect(parseSignups(description)).toEqual([
      { discordUserId: "618897639836090398", username: "leen8610", displayName: "Leen" },
      { discordUserId: "", username: "email:ann@example.org", displayName: "Ann" },
    ])
    expect(botParse(description).map((s) => s.username)).toEqual(["leen8610"])
    // And an email sign-up can be cancelled.
    expect(parseSignups(`${description}\n${cancelLine({ displayName: "Ann", handle: "email:ann@example.org" }, now)}`).map((s) => s.username)).toEqual(["leen8610"])
  })

  test("Brussels time, as the bot writes it", () => {
    expect(auditTimestamp(new Date("2026-01-15T08:30:00Z"))).toBe("15/01/2026 09:30")
  })
})

describe("cancel links", () => {
  const key = "test-secret"
  const claim = { e: "evt123", h: "leen8610", u: "618897639836090398", x: Math.floor(Date.parse("2026-10-07T18:30:00Z") / 1000) }

  test("round-trip, tamper-proof, and valid until the shift ends", () => {
    const token = signCancel(claim, key)
    expect(verifyCancel(token, Date.parse("2026-10-07T10:00:00Z"), key)).toEqual(claim)
    const [payload, sig] = token.split(".")
    const forged = Buffer.from(JSON.stringify({ ...claim, h: "someone-else" })).toString("base64url")
    expect(verifyCancel(`${forged}.${sig}`, Date.parse("2026-10-07T10:00:00Z"), key)).toBe("invalid")
    expect(verifyCancel(`${payload}.${sig}`, Date.parse("2026-10-07T10:00:00Z"), "other-key")).toBe("invalid")
    expect(verifyCancel(token, Date.parse("2026-10-07T19:00:00Z"), key)).toBe("expired")
    expect(verifyCancel("garbage", Date.now(), key)).toBe("invalid")
  })
})

describe("the confirmation", () => {
  const d = {
    memberName: "Ann",
    email: "ann@example.org",
    start: new Date("2026-10-07T15:30:00Z"),
    end: new Date("2026-10-07T18:30:00Z"),
    eventTitle: "Potluck",
    reward: { amount: 3, symbol: "CHT" },
    cancelUrl: "https://commonshub.brussels/shifts/cancel?t=abc",
    via: "tablet" as const,
  }

  test("the email says when, what, why shifts matter, where the handbook is, Elinor, and how to cancel", () => {
    const { subject, text } = buildShiftEmail(d)
    expect(subject).toBe("You're on shift: Wed 7 Oct, 17:30–20:30 at the Commons Hub")
    for (const part of ["You steward: Potluck", "3 tokens", "we never have the opportunity to make a good first impression twice", "https://commonshub.brussels/handbook", "Elinor", "Cancel: https://commonshub.brussels/shifts/cancel?t=abc"]) {
      expect(text).toContain(part)
    }
  })

  test("the calendar file", () => {
    const ics = buildShiftIcs(d)
    expect(ics).toContain("DTSTART:20261007T153000Z")
    expect(ics).toContain("DTEND:20261007T183000Z")
    expect(ics).toContain("SUMMARY:Caretaking shift: Potluck (Commons Hub Brussels)")
  })
})
