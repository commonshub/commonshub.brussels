import { describe, expect, test } from "@jest/globals"

import { bankCommunication, buildReminderEmail, signRenew, verifyRenew } from "@/lib/membership-reminder"
import { isValidStructuredCommunication, partnerCommunication, structuredCommunication } from "@/lib/structured-communication"

describe("Belgian structured communication", () => {
  test("ten digits and their check: the number modulo 97, 97 when it is 0", () => {
    expect(structuredCommunication("0000004522")).toBe("+++000/0004/52260+++") // 4522 % 97 = 60
    expect(structuredCommunication("0000000097")).toBe("+++000/0000/09797+++") // 97 % 97 = 0 → 97
    expect(partnerCommunication(4522)).toBe("+++000/0004/52260+++")
    expect(isValidStructuredCommunication("+++000/0004/52260+++")).toBe(true)
    expect(isValidStructuredCommunication("+++000/0004/52261+++")).toBe(false)
  })
})

describe("the renew link", () => {
  const key = "secret"
  const keys = [key]
  const claim = { n: "Ann", c: "cus_123", p: 4522, x: Math.floor(Date.parse("2026-11-01T00:00:00Z") / 1000) }

  test("signed, tamper-proof, expires", () => {
    const token = signRenew(claim, key)
    expect(verifyRenew(token, Date.parse("2026-10-10T00:00:00Z"), keys)).toEqual(claim)
    const [, sig] = token.split(".")
    const forged = Buffer.from(JSON.stringify({ ...claim, c: "cus_other" })).toString("base64url")
    expect(verifyRenew(`${forged}.${sig}`, Date.parse("2026-10-10T00:00:00Z"), keys)).toBeNull()
    expect(verifyRenew(token, Date.parse("2026-11-02T00:00:00Z"), keys)).toBeNull()
  })

  test("a link chb signs with the shared secret (plain HMAC-SHA256) is accepted next to the site's own", () => {
    const { createHmac } = require("crypto") as typeof import("crypto")
    const payload = Buffer.from(JSON.stringify(claim)).toString("base64url")
    const chbToken = `${payload}.${createHmac("sha256", "shared").update(payload).digest("base64url")}`
    expect(verifyRenew(chbToken, Date.parse("2026-10-10T00:00:00Z"), ["shared", "renew:site"])).toEqual(claim)
    expect(verifyRenew(chbToken, Date.parse("2026-10-10T00:00:00Z"), ["renew:site"])).toBeNull()
  })

  test("the bank communication: the member's structured one, or their name without an Odoo partner", () => {
    expect(bankCommunication(claim)).toBe("+++000/0004/52260+++")
    expect(bankCommunication({ n: "Ann" })).toBe("Membership Ann")
  })
})

describe("the reminder email", () => {
  test("two ways to pay (card for individuals, transfer for everyone), the grace period, the right yearly amount", () => {
    const base = { name: "Ann", email: "ann@example.org", renewUrl: "https://commonshub.brussels/membership/renew?t=x", communication: "+++000/0004/52260+++" }
    const paused = buildReminderEmail({ ...base, reason: "paused", graceEndsAt: new Date("2026-10-21T10:00:00Z") })
    expect(paused.subject).toBe("Your Commons Hub membership is paused")
    for (const part of ["You remain a member until Wednesday 21 October", "MONTHLY, BY CARD", "https://commonshub.brussels/membership/renew?t=x", "OR YEARLY, BY BANK TRANSFER", "Amount: €100", "Communication: +++000/0004/52260+++"]) {
      expect(paused.text).toContain(part)
    }
    const org = buildReminderEmail({ ...base, reason: "ended", organisation: true }).text
    expect(org).toContain("Amount: €200")
    expect(org).not.toContain("BY CARD")
  })
})

describe("the welcome email", () => {
  const { buildWelcomeEmail, WELCOME_PERKS } = require("@/lib/membership-welcome") as typeof import("@/lib/membership-welcome")

  test("an individual: first steps (Discord, Heartbeat, handbook, a shift) and their perks", () => {
    const e = buildWelcomeEmail({ name: "Ann", email: "ann@example.org" })
    expect(e.subject).toBe("Welcome to the Commons Hub, Ann 🎉")
    for (const s of ["https://discord.com/download", "https://discord.commonshub.brussels", "Heartbeat", "optional", "https://commonshub.brussels/handbook", "#door channel", "https://discord.com/channels/1280532848604086365/1306678821751230514", "https://elinor.commonshub.brussels"]) {
      expect(e.text).toContain(s)
      expect(e.html).toContain(s)
    }
    expect(e.text).toContain(WELCOME_PERKS.individual[1])
    expect(e.text).not.toContain(WELCOME_PERKS.organisation[0])
    // Just typing "open"; coworking days aren't part of the membership (VAT).
    expect(e.text).not.toContain("/open")
    expect(e.text).not.toMatch(/30%|one day a month/)
    expect(e.text).toContain("extra service")
    // Paying with tokens is not the euro service: said wherever tokens pay (VAT).
    const { TOKEN_TERMS } = require("@/lib/token-terms")
    expect(e.text).toContain(TOKEN_TERMS.coworking)
    expect(e.text).toContain(TOKEN_TERMS.rooms)
  })

  test("an organisation: named in the opening, organisation perks, escaped in HTML", () => {
    const e = buildWelcomeEmail({ name: "Bees & Co", email: "hello@bees.example", organisation: true })
    expect(e.subject).toBe("Welcome to the Commons Hub, Bees & Co 🎉")
    expect(e.text).toContain("making Bees & Co a member")
    expect(e.html).toContain("Bees &amp; Co")
    expect(e.text).toContain(WELCOME_PERKS.organisation[0])
  })
})
