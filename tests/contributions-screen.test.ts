/**
 * /contributions/screen: thank-yous from 💝praise and what people logged in
 * #contributions, as chb publishes them in the public tier.
 */
import { describe, expect, jest, test } from "@jest/globals"

jest.mock("@/lib/image-proxy", () => ({ getProxiedImageUrl: (url: string) => `proxy:${url}` }))

const { clip, contributionEmoji, gratitudeGraph, praiseText, recentContributions, recentPraises } = require("@/lib/contributions-screen") as typeof import("@/lib/contributions-screen")

const NOW = Date.parse("2026-10-06T16:00:00Z")
const leen = { id: "1", displayName: "Leen" }
const dean = { id: "2", displayName: "Dean" }
const marijke = { id: "3", displayName: "Marijke" }
const xavier = { id: "4", displayName: "Xavier" }

describe("a thank-you's words", () => {
  test("without the mentions it opens with; later mentions lose their @", () => {
    expect(praiseText("@Leen for figuring out the door!", ["Leen"])).toBe("for figuring out the door!")
    expect(praiseText("@Marijke and especially Thomas for the coffee machine", ["Marijke"])).toBe("and especially Thomas for the coffee machine")
    expect(praiseText("@Leen @Dean, for mopping the floor 🧹", ["Leen", "Dean"])).toBe("for mopping the floor 🧹")
    expect(praiseText("Thank you @Leen for hosting", ["Leen"])).toBe("Thank you Leen for hosting")
    expect(praiseText("see https://example.org now :party_blob:", [])).toBe("see now")
  })

  test("long ones are cut at a word, with an ellipsis", () => {
    expect(clip("one two three four five", 12)).toBe("one two…")
    expect(clip("short", 12)).toBe("short")
  })

  test("an emoji for a contribution without a photo", () => {
    expect(contributionEmoji("Vacuum cleaned Ostrom and Satoshi")).toBe("🧹")
    expect(contributionEmoji("Brought coffee beans")).toBe("☕")
    expect(contributionEmoji("Something else entirely")).toBe("✨")
  })
})

describe("recent thank-yous", () => {
  const feed = {
    messages: [
      { id: "a", timestamp: "2026-10-06T13:17:00Z", author: marijke, content: "@Leen for figuring out the door!", mentions: [leen] },
      { id: "b", timestamp: "2026-10-06T14:13:00Z", author: leen, content: "@Dean for mopping the floor", mentions: [dean] },
      { id: "c", timestamp: "2026-10-06T14:20:00Z", author: leen, content: "No one to thank here", mentions: [] },
      { id: "d", timestamp: "2026-10-06T14:30:00Z", author: leen, content: "@Leen thanks me", mentions: [leen] },
      { id: "e", timestamp: "2026-09-01T10:00:00Z", author: xavier, content: "@Leen long ago", mentions: [leen] },
    ],
  }

  test("newest first; only those that name someone else; within the window; each once", () => {
    const praises = recentPraises([feed, feed], { now: NOW, days: 14 })
    expect(praises.map((p) => p.id)).toEqual(["b", "a"])
    expect(praises[0]).toMatchObject({ from: { name: "Leen" }, to: [{ name: "Dean" }], text: "for mopping the floor" })
  })

  test("the constellation: one dot per person, one line per giver → receiver, laid out inside the frame", () => {
    const praises = recentPraises([feed], { now: NOW })
    const { nodes, edges } = gratitudeGraph(praises)
    expect(nodes.map((n) => n.name).sort()).toEqual(["Dean", "Leen", "Marijke"])
    expect(edges).toEqual(expect.arrayContaining([expect.objectContaining({ from: "1", to: "2" }), expect.objectContaining({ from: "3", to: "1" })]))
    for (const n of nodes) {
      expect(n.x).toBeGreaterThan(0)
      expect(n.x).toBeLessThan(1)
      expect(n.y).toBeGreaterThan(0)
      expect(n.y).toBeLessThan(1)
    }
    expect(nodes.find((n) => n.name === "Leen")!.weight).toBe(2)
    // Deterministic: the same data draws the same picture.
    expect(gratitudeGraph(praises)).toEqual(gratitudeGraph(praises))
  })
})

describe("recent contributions", () => {
  test("with words or a photo; photo proxied; top reactions; emoji", () => {
    const items = recentContributions([
      {
        messages: [
          { id: "1", timestamp: "2026-10-05T08:58:00Z", author: dean, content: "Brought toilet paper for the hub", images: ["2026/10/public/images/9.jpg"], reactions: [{ emoji: "❤️", count: 1 }, { emoji: "👍", count: 4 }] },
          { id: "2", timestamp: "2026-10-06T15:06:00Z", author: xavier, content: "Vacuum cleaned Ostrom and Satoshi." },
          { id: "3", timestamp: "2026-10-06T15:10:00Z", author: leen, content: "" },
        ],
      },
    ])
    expect(items.map((c) => c.id)).toEqual(["2", "1"])
    expect(items[0]).toMatchObject({ text: "Vacuum cleaned Ostrom and Satoshi.", emoji: "🧹" })
    expect(items[1].image).toBe("proxy:/data/2026/10/public/images/9.jpg")
    expect(items[1].reactions[0]).toEqual({ emoji: "👍", count: 4 })
  })
})

describe("chb 3.34 markup", () => {
  test("Markdown and links are reduced to their words; custom emoji reactions keep their image", () => {
    expect(praiseText("@Leen for **all** the [door work](https://x.org)\n- and more", ["Leen"])).toBe("for all the door work and more")
    const [item] = recentContributions([{ messages: [{ id: "1", timestamp: "2026-10-02T12:17:17Z", author: { id: "9", displayName: "AlainV" }, content: "Cleaning park by @Marlene and me", reactions: [{ emoji: ":chb:", count: 2, imageUrl: "https://cdn.discordapp.com/emojis/1.png" }] }] }])
    expect(item.text).toBe("Cleaning park by Marlene and me")
    expect(item.reactions[0]).toEqual({ emoji: ":chb:", count: 2, image: "proxy:https://cdn.discordapp.com/emojis/1.png" })
  })
})
