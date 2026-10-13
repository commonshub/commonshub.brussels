import { describe, expect, jest, test } from "@jest/globals"

// The relays are not what these tests are about (and their libraries are ES modules).
jest.mock("@/lib/nostr-server", () => ({ COMMUNITY: {}, coordinatorPubkey: () => null, publishAsSite: async () => null, queryRelays: async () => [], siteIdentity: () => null }))
jest.mock("nostr-tools/nip44", () => ({ getConversationKey: () => new Uint8Array(), encrypt: () => "", decrypt: () => "" }))
jest.mock("@/lib/token-balance", () => ({ tokenBalanceOf: async () => 0 }))
process.env.AUTH_SECRET = "test-secret"
/* eslint-disable @typescript-eslint/no-require-imports */
const { claimUrl, verifyClaim } = require("@/lib/membership-applications-store") as typeof import("@/lib/membership-applications-store")
const { buildWelcomeEmail } = require("@/lib/membership-welcome") as typeof import("@/lib/membership-welcome")
/* eslint-enable @typescript-eslint/no-require-imports */

describe("after paying: log in with Discord, get the member role", () => {
  test("the onboarding email's link is for that application only, and can't be forged", () => {
    const url = claimUrl("abc123")
    expect(url).toMatch(/^https:\/\/commonshub\.brussels\/membership\/welcome\?t=abc123\./)
    const t = decodeURIComponent(url.split("t=")[1])
    expect(verifyClaim(t)).toBe("abc123")
    expect(verifyClaim(t.replace("abc123", "abc124"))).toBeNull()
    expect(verifyClaim("abc123.xxxxxxxxxxxxxxxxxxxxxx")).toBeNull()
    expect(verifyClaim(null)).toBeNull()
  })

  test("the onboarding email starts with logging in with Discord; without the link (chb), it asks for the username", () => {
    const withLink = buildWelcomeEmail({ name: "Ann", email: "ann@example.org", claimUrl: claimUrl("abc123") })
    expect(withLink.text).toContain("1. Log in with Discord to get your member role.")
    expect(withLink.html).toContain("/membership/welcome?t=abc123.")
    expect(withLink.text).toContain("2. Open the door.")
    expect(buildWelcomeEmail({ name: "Ann", email: "ann@example.org" }).text).toContain("reply to this email with your Discord username")
  })
})
