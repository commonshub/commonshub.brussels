import { describe, expect, test } from "@jest/globals"

import {
  applicationIdFromReference,
  applicationUri,
  buildAcceptedEmail,
  buildReceivedEmail,
  buildVouch,
  isGibberishName,
  isMembershipLink,
  PAYMENT_LINKS,
  priceOf,
  typeOfLink,
  knownNames,
  parseApplication,
  paymentUrlFor,
  spamReason,
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
    expect(url).toBe("https://buy.stripe.com/5kQdR92CwbSMc719i9eUU0i?client_reference_id=application_abc123&prefilled_email=ann%40example.org")
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

describe("bots on the form", () => {
  test("gibberish names, not real ones", () => {
    for (const n of ["nntmgkmPCwTxURdm", "qWrtZpLkmXvB", "hGfDsAqWnBvC"]) expect(isGibberishName(n)).toBe(true)
    for (const n of ["Ann Smith", "Xavier", "TheCommonsHub", "ImpactHubBXL", "OpenCollective", "Schwarzschild", "MacDonald", "Jean-Pierre Van den Berghe", "ABCDEFGHIJKL"]) expect(isGibberishName(n)).toBe(false)
  })

  test("the trap field, the fill time, the name", () => {
    const person = { name: "Ann Smith", email: "a@b.co", homepage: "", elapsedMs: 45_000 }
    expect(spamReason(person)).toBeNull()
    expect(spamReason({ ...person, homepage: "http://spam.example" })).toBe("trap field filled")
    expect(spamReason({ ...person, elapsedMs: 800 })).toBe("sent after 800ms")
    expect(spamReason({ name: "Ann Smith", email: "a@b.co" })).toBe("no fill time")
    expect(spamReason({ ...person, name: "nntmgkmPCwTxURdm" })).toBe("gibberish name")
  })
})

describe("what they pay", () => {
  const base = { name: "Ann", email: "a@b.co" }
  test("individuals choose €10, €15 or €20 a month, €15 by default; others pay a year", () => {
    expect(parseApplication({ ...base, monthly: 10 }, "x")).toMatchObject({ monthly: 10 })
    expect(parseApplication({ ...base, monthly: "20" }, "x")).toMatchObject({ monthly: 20 })
    expect(parseApplication({ ...base, monthly: 3 }, "x")).toMatchObject({ monthly: 15 })
    expect(parseApplication(base, "x")).toMatchObject({ monthly: 15 })
    expect(parseApplication({ ...base, type: "organisation", monthly: 20 }, "x")).not.toHaveProperty("monthly")
  })

  test("each price has its link, all of them memberships, and the same emails", () => {
    const link = (a: Partial<Application>) => paymentUrlFor({ id: "abc123", email: "a@b.co", type: "individual", ...a }).split("?")[0]
    expect(link({ monthly: 10 })).toBe(PAYMENT_LINKS.individual10.url)
    expect(link({ monthly: 20 })).toBe(PAYMENT_LINKS.individual20.url)
    expect(link({})).toBe(PAYMENT_LINKS.individual10.url) // applied before the choice
    expect(link({ type: "organisation" })).toBe(PAYMENT_LINKS.organisation.url)
    expect(link({ type: "community" })).toBe(PAYMENT_LINKS.community.url)
    for (const l of Object.values(PAYMENT_LINKS)) expect(isMembershipLink(l.id)).toBe(true)
    expect(isMembershipLink("plink_fridge")).toBe(false)
    expect(typeOfLink(PAYMENT_LINKS.organisation.id)).toBe("organisation")
    expect(typeOfLink(PAYMENT_LINKS.individual20.id)).toBe("individual")
    for (const monthly of [10, 15, 20] as const) {
      const a = { ...app, monthly }
      const accepted = buildAcceptedEmail(a, [{ name: "Leen" }], paymentUrlFor(a)).text
      // Their choice is the button; the two other amounts are offered too, each with its own link.
      expect(accepted).toContain(`Pay €${monthly} a month: ${paymentUrlFor(a)}`)
      for (const other of [10, 15, 20].filter((m) => m !== monthly) as Array<10 | 15 | 20>) expect(accepted).toContain(paymentUrlFor({ ...a, monthly: other }))
      expect(accepted).toContain("you can change it anytime")
      expect(accepted).toContain(`- €${monthly} (${monthly === 10 ? "Solidarity" : monthly === 15 ? "Regular" : "Support"}), your choice: ${paymentUrlFor(a)}`)
      // The year by bank transfer: a page tied to the application by its id only.
      for (const yearly of [100, 150, 200]) expect(accepted).toContain(`https://commonshub.brussels/membership/pay/${yearly}?ref=abc123`)
      expect(accepted).not.toMatch(/membership\/pay\/[^\s]*(ann|example)/i)
    }
    expect(buildAcceptedEmail({ ...app, type: "organisation" }, [{ name: "Leen" }], PAYMENT_LINKS.organisation.url).text).not.toContain("a month")
    expect(buildReceivedEmail({ ...app, monthly: 10 }).text).toContain("Membership: €10 a month (solidarity)")
    expect(priceOf({ type: "organisation" })).toBe("€200 a year")
  })

  test("members don't see what someone chose to pay", () => {
    expect(withoutEmail({ ...app, monthly: 10 })).not.toHaveProperty("monthly")
  })
})
