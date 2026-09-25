import { describe, expect, test } from "@jest/globals"
import {
  KIND_ATTESTATION,
  KIND_RSVP,
  KIND_SHIFT,
  buildAttestation,
  buildCommunityDefinition,
  buildProfile,
  buildRsvp,
  buildShiftOccurrence,
  parseAttestations,
  parseProfiles,
  parseSignups,
  shiftCoordinate,
} from "@/lib/nostr-conventions"

const community = { guildId: "1280532848604086365", name: "Commons Hub Brussels" }
const SITE = "727bdf54ac689a75cf875446dd242091d6ebfc199bd58fce1c668f8405183492"
const slot = { start: "08:30", end: "11:30" }
const later = { start: "11:30", end: "14:30" }
const DAY = "2026-09-22"
const when = new Date("2026-09-20T10:00:00Z")

describe("every event names the community and the app", () => {
  test("occurrence, RSVP, attestation and community definition carry i/k and app tags", () => {
    for (const event of [
      buildShiftOccurrence(community, SITE, DAY, slot, 3, "Caretaking shift", when),
      buildRsvp("signup", community, SITE, SITE, DAY, slot, when),
      buildAttestation({ id: "1", name: "Doug" }, [SITE], community, SITE, when),
      buildCommunityDefinition(community, SITE, "The hub", when),
    ]) {
      expect(event.tags).toContainEqual(["i", "discord:1280532848604086365"])
      expect(event.tags).toContainEqual(["k", "discord"])
      expect(event.tags).toContainEqual(["t", "app:commonshub.brussels"])
      expect(event.tags.find((t) => t[0] === "client")).toEqual(["client", "commonshub.brussels", `31990:${SITE}:web`])
    }
  })
})

describe("shifts", () => {
  test("the occurrence mirrors Elinor's shape, in Brussels time", () => {
    const occ = buildShiftOccurrence(community, SITE, DAY, slot, 3, "Caretaking shift", when)
    expect(occ.kind).toBe(KIND_SHIFT)
    expect(occ.tags).toContainEqual(["d", "shift-1280532848604086365-2026-09-22-0830"])
    expect(occ.tags).toContainEqual(["capacity", "3"])
    expect(occ.tags).toContainEqual(["t", "group-1280532848604086365"])
    expect(occ.tags).toContainEqual(["a", `34550:${SITE}:dc1280532848604086365`])
    const start = Number(occ.tags.find((t) => t[0] === "start")![1])
    expect(new Date(start * 1000).toISOString()).toBe("2026-09-22T06:30:00.000Z") // 08:30 CEST
    expect(shiftCoordinate(SITE, community, DAY, slot)).toBe(`31923:${SITE}:shift-1280532848604086365-2026-09-22-0830`)
  })

  test("an RSVP points at the shift and a cancellation replaces it", () => {
    const rsvp = buildRsvp("signup", community, SITE, SITE, DAY, slot, when)
    expect(rsvp.kind).toBe(KIND_RSVP)
    expect(rsvp.tags).toContainEqual(["a", shiftCoordinate(SITE, community, DAY, slot)])
    expect(rsvp.tags).toContainEqual(["d", "rsvp-1280532848604086365-2026-09-22-0830"])
    expect(rsvp.tags).toContainEqual(["status", "accepted"])
    expect(buildRsvp("cancel", community, SITE, SITE, DAY, slot, when).tags).toContainEqual(["status", "declined"])
  })

  test("sign-ups are read newest-per-author, accepted only, named through attestations and profiles", () => {
    const doug = "a".repeat(64), zak = "b".repeat(64), ann = "c".repeat(64)
    const at = (pubkey: string, action: "signup" | "cancel", s: typeof slot, t: string) => ({ pubkey, ...buildRsvp(action, community, SITE, SITE, DAY, s, new Date(t)) })
    const rsvps = [
      at(doug, "signup", slot, "2026-09-20T10:00:00Z"),
      at(zak, "signup", slot, "2026-09-20T11:00:00Z"),
      at(doug, "cancel", slot, "2026-09-21T09:00:00Z"),
      at(doug, "signup", later, "2026-09-21T09:01:00Z"),
      { pubkey: ann, ...buildRsvp("signup", community, SITE, SITE, "2026-09-23", slot, when) },
      // The site's own older sign-ups named the member under the site key.
      { pubkey: SITE, kind: KIND_RSVP, created_at: 1, tags: [["a", shiftCoordinate(SITE, community, DAY, later)], ["d", "legacy"], ["status", "accepted"], ["discord", "9"], ["name", "Legacy Lou"]], content: "" },
    ]
    const links = parseAttestations([{ pubkey: SITE, ...buildAttestation({ id: "100", name: "Doug D." }, [doug], community, SITE, when) }], [SITE])
    const profiles = parseProfiles([{ pubkey: zak, ...buildProfile({ id: "200", name: "Zak", avatar: "https://cdn/x.png" }, when) }])
    const signups = parseSignups(rsvps, SITE, community, DAY, [slot, later], links, profiles)
    expect(signups.map((s) => [s.name, s.slotCode, s.discordId])).toEqual([
      ["Legacy Lou", "1130", "9"],
      ["Zak", "0830", "200"],
      ["Doug D.", "1130", "100"],
    ])
    expect(signups[1].picture).toBe("https://cdn/x.png")
    expect(signups[0].signedBy?.name).toBe("the site")
  })

  test("a steward can sign someone else up and either side can cancel; non-stewards cannot", () => {
    const steward = "d".repeat(64), doug = "a".repeat(64), rando = "e".repeat(64)
    const forDoug = { id: "100", name: "Doug D." }
    const rsvpFor = (pubkey: string, action: "signup" | "cancel", t: string, s = slot) => ({ pubkey, ...buildRsvp(action, community, SITE, SITE, DAY, s, new Date(t), forDoug) })
    const links = parseAttestations(
      [
        { pubkey: SITE, ...buildAttestation({ id: "300", name: "Sam Steward" }, [steward], community, SITE, when, ["steward"]) },
        { pubkey: SITE, ...buildAttestation({ id: "100", name: "Doug D." }, [doug], community, SITE, when) },
      ],
      [SITE],
    )
    expect(links.find((l) => l.discordId === "300")?.roles).toEqual(["steward"])

    const template = buildRsvp("signup", community, SITE, SITE, DAY, slot, when, forDoug)
    expect(template.tags).toContainEqual(["d", "rsvp-1280532848604086365-2026-09-22-0830-discord:100"])
    expect(template.tags).toContainEqual(["discord", "100"])
    expect(template.tags).toContainEqual(["t", "on-behalf"])

    // Steward books Doug; a stranger's attempt is ignored.
    let signups = parseSignups([rsvpFor(steward, "signup", "2026-09-20T10:00:00Z"), rsvpFor(rando, "signup", "2026-09-20T10:00:00Z", later)], SITE, community, DAY, [slot, later], links, [])
    expect(signups.map((s) => [s.name, s.slotCode, s.discordId, s.signedBy?.name])).toEqual([["Doug D.", "0830", "100", "Sam Steward"]])
    expect(signups[0].pubkey).toBe(doug)

    // Doug cancels it himself with his own key: newest per (attendee, slot) wins.
    const dougCancels = { pubkey: doug, ...buildRsvp("cancel", community, SITE, SITE, DAY, slot, new Date("2026-09-21T10:00:00Z")) }
    expect(parseSignups([rsvpFor(steward, "signup", "2026-09-20T10:00:00Z"), dougCancels], SITE, community, DAY, [slot], links, [])).toEqual([])

    // And the steward can cancel what Doug booked himself.
    const dougSigns = { pubkey: doug, ...buildRsvp("signup", community, SITE, SITE, DAY, slot, new Date("2026-09-20T10:00:00Z")) }
    expect(parseSignups([dougSigns, rsvpFor(steward, "cancel", "2026-09-21T10:00:00Z")], SITE, community, DAY, [slot], links, [])).toEqual([])
    expect(parseSignups([dougSigns], SITE, community, DAY, [slot], links, [])).toHaveLength(1)
  })
})

describe("identity", () => {
  test("the profile carries a NIP-39 discord claim and the Discord picture", () => {
    const profile = buildProfile({ id: "100", name: "Doug", username: "dougp", avatar: "https://cdn/a.png" }, when)
    expect(profile.kind).toBe(0)
    expect(profile.tags).toEqual([["i", "discord:100"], ["k", "discord"]])
    expect(JSON.parse(profile.content)).toMatchObject({ name: "Doug", picture: "https://cdn/a.png" })
  })

  test("an attestation lists every key; the newest per member wins; untrusted providers are ignored", () => {
    const k1 = "1".repeat(64), k2 = "2".repeat(64), k3 = "3".repeat(64)
    const first = { pubkey: SITE, ...buildAttestation({ id: "100", name: "Doug" }, [k1], community, SITE, new Date("2026-09-20T10:00:00Z")) }
    const second = { pubkey: SITE, ...buildAttestation({ id: "100", name: "Doug" }, [k1, k2], community, SITE, new Date("2026-09-21T10:00:00Z")) }
    const rogue = { pubkey: "f".repeat(64), ...buildAttestation({ id: "100", name: "Mallory" }, [k3], community, SITE, when) }
    expect(first.kind).toBe(KIND_ATTESTATION)
    expect(first.tags).toContainEqual(["d", "discord:100"])
    const links = parseAttestations([second, first, rogue], [SITE])
    expect(links).toEqual([{ discordId: "100", name: "Doug", keys: [k1, k2], roles: [] }])
  })
})

describe("comments", () => {
  test("a comment names its subject with I/K and is told apart from an annotation", async () => {
    const { buildComment, isComment, parseComments } = await import("@/lib/nostr-conventions")
    const uri = "chb:bill:b-b7e6ee1b53"
    const c = buildComment(uri, "chb:bill", "  Paid by direct debit on the 3rd, can be reconciled.  ", community, SITE, when)
    expect(c.kind).toBe(1111)
    expect(c.tags.slice(0, 4)).toEqual([["I", uri], ["K", "chb:bill"], ["i", uri], ["k", "chb:bill"]])
    expect(c.content).toBe("Paid by direct debit on the 3rd, can be reconciled.")
    expect(isComment(c)).toBe(true)
    // An annotation snapshot has the same kind but no uppercase I.
    expect(isComment({ kind: 1111, tags: [["i", uri], ["k", "chb:bill"], ["category", "utilities"]] })).toBe(false)

    const member = "a".repeat(64)
    const links = parseAttestations([{ pubkey: SITE, ...buildAttestation({ id: "100", name: "Doug D." }, [member], community, SITE, when) }], [SITE])
    const events = [
      { id: "2", pubkey: member, ...buildComment(uri, "chb:bill", "Second", community, SITE, new Date("2026-09-26T10:00:00Z")) },
      { id: "1", pubkey: member, ...buildComment(uri, "chb:bill", "First", community, SITE, new Date("2026-09-25T10:00:00Z")) },
      { id: "3", pubkey: member, ...buildComment("chb:bill:other", "chb:bill", "Elsewhere", community, SITE, when) },
      { id: "4", pubkey: member, kind: 1111, created_at: 1, tags: [["i", uri]], content: "annotation" },
    ]
    expect(parseComments(events, uri, links, []).map((x) => [x.content, x.name])).toEqual([
      ["First", "Doug D."],
      ["Second", "Doug D."],
    ])
  })
})
