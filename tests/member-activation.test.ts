import { describe, expect, jest, test } from "@jest/globals"

// The relays and Discord are not what these tests are about (and their libraries are ES modules).
jest.mock("@/lib/nostr-server", () => ({ COMMUNITY: {}, coordinatorPubkey: () => null, publishAsSite: async () => null, queryRelays: async () => [], siteIdentity: () => null }))
jest.mock("nostr-tools/nip44", () => ({ getConversationKey: () => new Uint8Array(), encrypt: () => "", decrypt: () => "" }))
/* eslint-disable @typescript-eslint/no-require-imports */
const { membershipToActivate } = require("@/lib/member-activation") as typeof import("@/lib/member-activation")
/* eslint-enable @typescript-eslint/no-require-imports */
import type { Member } from "@/types/members"

const member = (emailHash: string, status: Member["status"], firstName = "Mathieu") => ({ id: "sub_1", source: "stripe", firstName, status, accounts: { emailHash, discord: null } }) as unknown as Member
const A = "a".repeat(64)
const B = "b".repeat(64)

describe("signed in without the member role, but paying", () => {
  const members = [member(A, "active"), member(B, "canceled", "Ann")]

  test("the current membership paid with their address is theirs to activate", () => {
    expect(membershipToActivate(A, "111", members, [])).toMatchObject({ firstName: "Mathieu" })
    expect(membershipToActivate(A, "111", [member(A, "past_due")], [])).toMatchObject({ status: "past_due" })
  })

  test("no address, no such membership, or one that ended: none", () => {
    expect(membershipToActivate(null, "111", members, [])).toBe("none")
    expect(membershipToActivate("c".repeat(64), "111", members, [])).toBe("none")
    expect(membershipToActivate(B, "111", members, [])).toBe("none")
    expect(membershipToActivate(A, "111", null, [])).toBe("none")
  })

  test("a membership another Discord account confirmed is taken; their own link, a name or a payment don't count", () => {
    expect(membershipToActivate(A, "111", members, [{ discordId: "222", emailHash: A, source: "login" }])).toBe("taken")
    expect(membershipToActivate(A, "111", members, [{ discordId: "222", emailHash: A, source: "email" }])).toBe("taken")
    expect(membershipToActivate(A, "111", members, [{ discordId: "111", emailHash: A, source: "login" }])).toMatchObject({ firstName: "Mathieu" })
    expect(membershipToActivate(A, "111", members, [{ discordId: "222", emailHash: A, source: "name" }])).toMatchObject({ firstName: "Mathieu" })
    expect(membershipToActivate(A, "111", members, [{ discordId: "222", emailHash: B, source: "login" }])).toMatchObject({ firstName: "Mathieu" })
  })
})
