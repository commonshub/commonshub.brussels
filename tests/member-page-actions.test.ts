/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals"
import { canPost, channelPermissions, discordText, emailText, parseAction, RateLimiter } from "@/lib/member-page-actions"

const ctx = { pageTitle: "Potluck sign-up", pageUrl: "https://commonshub.brussels/members/alice/potluck", author: "alice", sender: "bob" }

describe("parseAction", () => {
  test("a Discord message to the author by default, with form fields", () => {
    expect(parseAction("discord", { content: " Count me in ", fields: { dish: "Lasagna", people: 2 } })).toEqual({
      kind: "discord",
      to: "author",
      content: "Count me in",
      fields: [
        ["dish", "Lasagna"],
        ["people", "2"],
      ],
    })
  })

  test("refuses what can't be sent as is", () => {
    expect(() => parseAction("discord", {})).toThrow(/Nothing to send/)
    expect(() => parseAction("discord", { to: "#general", content: "x" })).toThrow(/to must be/)
    expect(() => parseAction("email", { content: "x" })).toThrow(/subject/)
    expect(() => parseAction("email", { subject: "Hi", content: "x", replyTo: "not an email" })).toThrow(/replyTo/)
    expect(() => parseAction("webhook", { content: "x" })).toThrow(/Unknown/)
  })

  test("strips bidi overrides and control characters, caps lengths", () => {
    const a = parseAction("discord", { content: "safe‮txt.exe\u0007" + "x".repeat(3000) })
    expect(a.content.startsWith("safetxt.exe")).toBe(true)
    expect(a.content.length).toBe(1500)
  })
})

describe("what is sent", () => {
  test("Discord: our attribution line, then their text quoted, so it can't pose as the site", () => {
    const text = discordText({ kind: "discord", to: "author", content: "📝 **@xavier** via [Official](<https://x>):\nhi", fields: [["dish", "Soup"]] }, ctx)
    const lines = text.split("\n")
    expect(lines[0]).toBe("📝 **@bob** via [Potluck sign-up](<https://commonshub.brussels/members/alice/potluck>):")
    expect(lines.slice(1).every((l) => l.startsWith("> "))).toBe(true)
    expect(text).toContain("> **dish**: Soup")
  })

  test("email: to hello@ with the page in the subject and who sent it", () => {
    const { subject, text } = emailText({ kind: "email", subject: "Room question", content: "Can we use the room?", replyTo: "bob@example.org" }, ctx)
    expect(subject).toBe("[Potluck sign-up] Room question")
    expect(text).toContain("Sent by @bob (Discord) from Potluck sign-up, a page by @alice")
    expect(text).toContain("Reply goes to: bob@example.org")
  })
})

describe("RateLimiter", () => {
  test("per page and per person", () => {
    const limiter = new RateLimiter([
      { max: 2, windowMs: 1000 },
      { max: 3, windowMs: 10_000 },
    ])
    expect(limiter.take(["bob:a", "bob"], 0)).toBe(true)
    expect(limiter.take(["bob:a", "bob"], 1)).toBe(true)
    expect(limiter.take(["bob:a", "bob"], 2)).toBe(false)
    expect(limiter.take(["bob:b", "bob"], 3)).toBe(true)
    expect(limiter.take(["bob:c", "bob"], 4)).toBe(false)
    expect(limiter.take(["bob:a", "bob"], 20_000)).toBe(true)
  })
})

describe("channelPermissions", () => {
  const VIEW = String(1 << 10)
  const SEND = String(1 << 11)
  const both = String((1 << 10) | (1 << 11))
  const base = { guildId: "g", userId: "u", roles: [{ id: "g", permissions: both }, { id: "member", permissions: "0" }] }

  test("a channel @everyone can't post in, open to members", () => {
    const overwrites = [
      { id: "g", type: 0 as const, allow: "0", deny: SEND },
      { id: "member", type: 0 as const, allow: SEND, deny: "0" },
    ]
    expect(canPost(channelPermissions({ ...base, memberRoles: [], overwrites }), false)).toBe(false)
    expect(canPost(channelPermissions({ ...base, memberRoles: ["member"], overwrites }), false)).toBe(true)
  })

  test("a member overwrite wins; a hidden channel is never postable", () => {
    expect(canPost(channelPermissions({ ...base, memberRoles: ["member"], overwrites: [{ id: "u", type: 1, allow: "0", deny: SEND }] }), false)).toBe(false)
    expect(canPost(channelPermissions({ ...base, memberRoles: [], overwrites: [{ id: "g", type: 0, allow: "0", deny: VIEW }] }), false)).toBe(false)
  })

  test("threads need send-in-threads", () => {
    expect(canPost(channelPermissions({ ...base, memberRoles: [], overwrites: [] }), true)).toBe(false)
  })
})
