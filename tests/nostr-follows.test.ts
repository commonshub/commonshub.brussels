import { describe, expect, test } from "@jest/globals"
import settings from "@/settings/settings.json"
import { mergeContactList } from "@/lib/nostr-conventions"

const BOT = "3a8e28239a331f2791fd30ebd4029c4bc973b6465b4e54700841d9c26c08c1f3"
const BOT_NPUB = "npub1828zsgu6xv0j0y0axr4agq5uf0yh8djxtd89guqgg8vuymqgc8es3ge93h"

describe("the site's contact list", () => {
  test("follows the token bot (settings.nostr.follows)", () => {
    expect(settings.nostr.follows).toContain(BOT_NPUB)
    expect(settings.nostr.coordinatorNpub).toBe(BOT_NPUB) // the coordinator is the token bot
  })

  test("adds what is missing, keeps every other tag and the content, does nothing when complete", () => {
    expect(mergeContactList(null, [BOT], 100)).toEqual({ kind: 3, created_at: 100, tags: [["p", BOT]], content: "" })
    const existing = { tags: [["p", "aaa", "wss://relay"], ["t", "x"]], content: "{}" }
    expect(mergeContactList(existing, [BOT, "aaa"], 100)).toEqual({ kind: 3, created_at: 100, tags: [["p", "aaa", "wss://relay"], ["t", "x"], ["p", BOT]], content: "{}" })
    expect(mergeContactList({ tags: [["p", BOT]], content: "" }, [BOT])).toBeNull()
  })
})
