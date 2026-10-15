import { describe, expect, test } from "@jest/globals"

import {
  applicationIdFromReference,
  applicationUri,
  buildAcceptedEmail,
  buildReceivedEmail,
  buildVouch,
  knownNames,
  parseApplication,
  paymentUrlFor,
  vouchersOf,
  withoutEmail,
  type Application,
} from "@/lib/membership-application"

const now = new Date("2026-10-13T10:00:00Z")
const app = parseApplication(
  { type: "individual", name: " Ann Smith ", email: "Ann@Example.org", needs: ["I need a space to work"], contribute: "Workshops", heardFrom: "A friend", whoYouKnow: "Leen" },
  "abc123",
  now,
) as Application

describe("a membership application", () => {
  test("from the form: trimmed, the email in lower case, pending", () => {
    expect(app).toMatchObject({ id: "abc123", name: "Ann Smith", email: "ann@example.org", status: "pending", heardFrom: "A friend", whoYouKnow: "Leen", contribute: "Workshops" })
    expect(parseApplication({ name: "", email: "a@b.co" }, "x")).toEqual({ error: "Please tell us your name" })
    expect(parseApplication({ name: "Ann", email: "nope" }, "x")).toEqual({ error: "Please enter a valid email address" })
    expect(parseApplication({ name: "Ann", email: "a@b.co" }, "x")).toMatchObject({ contribute: undefined, needs: [] })
  })

  test("members see everything but the email address", () => {
    expect(JSON.stringify(withoutEmail(app))).not.toContain("example.org")
  })

  test("the first email: pending, we'll get back asap, the potluck, their answers", () => {
    const { subject, html, text } = buildReceivedEmail(app)
    // One thread per applicant in the shared inbox: the name is in the subject.
    expect(subject).toBe("Your membership application to the Commons Hub: Ann Smith")
    expect(text).toContain("Hi Ann,")
    expect(text).toContain("Your application is pending")
    expect(text).toContain("as soon as possible")
    expect(text).toContain("https://commonshub.brussels/potluck")
    expect(text).toContain("Who you know at the hub: Leen")
    expect(html).toContain('href="https://commonshub.brussels/potluck"')
  })

  test("accepted: who vouched, the payment link tied to the application, onboarding after paying", () => {
    const url = paymentUrlFor(app)
    expect(url).toBe("https://buy.stripe.com/00g9C7dFH8EI07eaEJ?client_reference_id=application_abc123&prefilled_email=ann%40example.org")
    expect(applicationIdFromReference("application_abc123")).toBe("abc123")
    expect(applicationIdFromReference("fridge")).toBeNull()
    const { text } = buildAcceptedEmail(app, [{ name: "Leen" }, { name: "Miriam" }, { name: "Xavier" }], url)
    expect(text).toContain("Leen, Miriam and Xavier vouched for you")
    expect(text).toContain(url)
    expect(text).toContain("onboarding email")
  })
})

describe("vouching", () => {
  const site = "s".repeat(64)
  const community = { guildId: "1", name: "Hub" }
  const vouch = (pubkey: string, at: number, id = "abc123") => ({ ...buildVouch(id, "Ann", community, site), pubkey, created_at: at })
  const links = [
    { discordId: "1", name: "Leen", keys: ["k1", "k1b"], roles: [] },
    { discordId: "2", name: "Miriam", keys: ["k2"], roles: [] },
    { discordId: "3", name: "Broke", keys: ["k3"], roles: [] },
  ]

  test("a vouch is a NIP-22 comment on the application, tagged vouch", () => {
    const v = buildVouch("abc123", "Ann", community, site)
    expect(v.kind).toBe(1111)
    expect(v.tags).toContainEqual(["I", applicationUri("abc123")])
    expect(v.tags).toContainEqual(["t", "vouch"])
  })

  test("one per member (any of their keys), only attested members with tokens, only for this application", () => {
    const events = [vouch("k1", 1), vouch("k1b", 2), vouch("k2", 3), vouch("k3", 4), vouch("stranger", 5), vouch("k2", 6, "other1")]
    expect(vouchersOf(events, "abc123", links, (d) => d !== "3").map((v) => v.name)).toEqual(["Leen", "Miriam"])
  })
})

describe("vouching by reacting on Discord", () => {
  const site = "s".repeat(64)
  const community = { guildId: "1", name: "Hub" }
  test("the site's vouch on behalf of a member who reacted counts for that member, once, only with tokens", () => {
    const onBehalf = (discordId: string, name: string, at: number) => ({ ...buildVouch("abc123", "Ann", community, site, new Date(), { discordId, name }), pubkey: site, created_at: at })
    const theirOwn = { ...buildVouch("abc123", "Ann", community, site), pubkey: "k1", created_at: 5 }
    const links = [{ discordId: "1", name: "Leen", keys: ["k1"], roles: [] }]
    const events = [onBehalf("1", "Leen", 1), onBehalf("2", "Miriam", 2), onBehalf("3", "Broke", 3), theirOwn]
    expect(vouchersOf(events, "abc123", links, (d) => d !== "3", site).map((v) => v.name)).toEqual(["Leen", "Miriam"])
    // Signed by anyone else, a "discord" tag means nothing.
    expect(vouchersOf([{ ...onBehalf("2", "Miriam", 2), pubkey: "intruder" }], "abc123", links, () => true, site)).toEqual([])
    expect(onBehalf("2", "Miriam", 2).tags).toContainEqual(["t", "on-behalf"])
  })
})

describe("who they know at the hub", () => {
  test("members picked from Discord (ids checked, deduplicated) and names typed by hand", () => {
    const a = parseApplication(
      { name: "Bo", email: "bo@example.org", knows: [{ id: "618897639836090398", name: "Leen" }, { id: "618897639836090398", name: "Leen" }, { id: "<@everyone>", name: "x" }, { id: "907316481405124628", name: "Mir<iam>" }], whoYouKnow: "Jan" },
      "abc123",
    ) as Application
    expect(a.knows).toEqual([
      { discordId: "618897639836090398", name: "Leen" },
      { discordId: "907316481405124628", name: "Miriam" },
    ])
    expect(knownNames(a)).toBe("Leen, Miriam, Jan")
    expect(buildReceivedEmail(a).text).toContain("Who you know at the hub: Leen, Miriam, Jan")
  })
})

describe("who vouched, on the Discord post", () => {
  const { withVouchLine } = require("@/lib/membership-application")
  const post = "👋 **New membership application: Ana**\nMembers with tokens: react with ✅ to vouch."
  test("adds one line, replaced as vouches come and go, whichever way they were given", () => {
    const one = withVouchLine(post, [{ discordId: "1" }])
    expect(one).toBe(`${post}\n\n**Vouched (1 of 3):** <@1>`)
    const two = withVouchLine(one, [{ discordId: "1" }, { discordId: "2" }])
    expect(two).toBe(`${post}\n\n**Vouched (2 of 3):** <@1> <@2>`)
    expect(withVouchLine(two, [])).toBe(post)
    expect(withVouchLine(two, [{ discordId: "1" }, { discordId: "2" }])).toBe(two)
  })
  test("stays within Discord's 2000 characters", () => {
    expect(withVouchLine("x".repeat(1990), [{ discordId: "123456789012345678" }]).length).toBeLessThanOrEqual(2000)
  })
})
