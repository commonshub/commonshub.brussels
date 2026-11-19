import { describe, expect, it } from "@jest/globals"

import { readLinkIntent, signLinkIntent } from "@/lib/link-intent"

describe("link Discord intent", () => {
  process.env.AUTH_SECRET = "s".repeat(32)
  const now = 1_800_000_000_000
  const value = signLinkIntent({ partnerId: 1276, email: "barbara@donut.example", name: "Barbara" }, now)!

  it("reads back what was signed, for ten minutes", () => {
    expect(readLinkIntent(value, now + 60_000)).toMatchObject({ partnerId: 1276, email: "barbara@donut.example" })
    expect(readLinkIntent(value, now + 11 * 60_000)).toBeNull()
  })

  it("refuses a changed or unsigned cookie", () => {
    const [payload, mac] = value.split(".")
    const forged = Buffer.from(JSON.stringify({ partnerId: 1, email: "x@y.example", name: "X", exp: now + 60_000 })).toString("base64url")
    expect(readLinkIntent(`${forged}.${mac}`, now)).toBeNull()
    expect(readLinkIntent(payload, now)).toBeNull()
    expect(readLinkIntent(undefined, now)).toBeNull()
  })
})
