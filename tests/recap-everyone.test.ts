/**
 * The recap for every member: the community part (money in against costs, care shifts, featured
 * events), and the version for a member chb doesn't know on Discord, with a link-Discord button.
 */
import { communityOnlyRecap, parsePeriod } from "@/lib/monthly-recap"
import { buildRecapEmail } from "@/lib/monthly-recap-email"
import { careOf, featuredEvents } from "@/lib/recap-community"
import { signDiscordLinkToken, signSettingsLink, verifyDiscordLinkToken, verifySettingsLink } from "@/lib/notification-links"
import type { HostedEvent } from "@/lib/hosted-events"

const HASH = "a".repeat(64)
const period = parsePeriod("2026", "11")!
const community = { income: 6120.4, costs: 8000, months: 1, mainCosts: [{ label: "Rent", monthly: 5500 }, { label: "Cleaning", monthly: 900 }], care: { people: 7, hours: 31.5 } }

test("care shifts: distinct people, hours per signup", () => {
  const s = (start: string, end: string, ...who: string[]) => ({ start, end, signups: who.map((k) => ({ key: k, username: k })) })
  expect(careOf([s("2026-11-03T08:00:00Z", "2026-11-03T12:00:00Z", "a", "b"), s("2026-11-04T08:00:00Z", "2026-11-04T09:30:00Z", "a")])).toEqual({ people: 2, hours: 9.5 })
})

test("featured events: the hosted ones still to come, soonest first", () => {
  const ev = (slug: string, startAt: string, featured?: boolean) => ({ slug, name: slug.toUpperCase(), startAt, endAt: startAt, tagline: `about ${slug}`, featured }) as unknown as HostedEvent
  const now = new Date("2026-12-01T09:00:00Z")
  expect(featuredEvents(now, 2, [ev("late", "2027-05-01T10:00:00Z"), ev("past", "2026-10-01T10:00:00Z"), ev("soon", "2027-01-10T10:00:00Z"), ev("hidden", "2027-01-01T10:00:00Z", false)])).toEqual([
    { name: "SOON", start: "2027-01-10T10:00:00Z", url: "https://commonshub.brussels/events/soon", tagline: "about soon" },
    { name: "LATE", start: "2027-05-01T10:00:00Z", url: "https://commonshub.brussels/events/late", tagline: "about late" },
  ])
})

test("a member without Discord: the community, a link-Discord button, no personal numbers", () => {
  process.env.RENEW_LINK_SECRET = "s".repeat(32)
  const r = communityOnlyRecap("Marianne", period, new Date("2026-12-01T09:00:00Z"))
  r.community = community
  r.featured = [{ name: "Open Source Village", start: "2027-01-10T10:00:00Z", url: "https://commonshub.brussels/events/osv", tagline: "A week of open source" }]
  const link = `https://commonshub.brussels/link-discord?t=${signDiscordLinkToken(HASH)}`
  const { html, text } = buildRecapEmail(r, { linkDiscord: link })
  expect(html).toContain("Hi Marianne, here's your November 2026")
  expect(html).toContain("Link my Discord account")
  expect(html).not.toContain("days at the hub")
  expect(html).not.toContain("See this online")
  expect(html).toContain("€6,120")
  expect(html).toContain("rent €5,500")
  expect(html).toContain("77% of our fixed costs covered")
  expect(html).toContain("7 people</strong> gave <strong>31.5 hours")
  expect(html).toContain("Open Source Village")
  expect(html).toContain("commonshub-favicon.png")
  expect(html).not.toContain("commonshub-logo-sticker.png")
  expect(text).toContain(link)
})

test("signed links: settings for e:<emailHash>, and the link-Discord token", () => {
  process.env.RENEW_LINK_SECRET = "s".repeat(32)
  expect(verifySettingsLink(signSettingsLink(`e:${HASH}`))?.d).toBe(`e:${HASH}`)
  expect(verifySettingsLink(signSettingsLink("e:nothex"))).toBe(null)
  const t = signDiscordLinkToken(HASH)
  expect(verifyDiscordLinkToken(t)).toBe(HASH)
  expect(verifyDiscordLinkToken(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBe(null)
  // A settings token is not a link token, and the other way round.
  expect(verifyDiscordLinkToken(signSettingsLink("123456789"))).toBe(null)
  expect(verifySettingsLink(t)).toBe(null)
})

test("the mosaic follows the care line, featured events show their cover, no −0", () => {
  process.env.RENEW_LINK_SECRET = "s".repeat(32)
  const r = communityOnlyRecap("Marianne", period, new Date("2026-12-01T09:00:00Z"))
  r.community = community
  r.featured = [{ name: "OSV", start: "2027-01-10T10:00:00Z", url: "https://commonshub.brussels/events/osv", cover: "https://commonshub.brussels/images/events/osv-2027.png" }]
  r.photos = [{ src: "/data/2026/11/members/images/a.jpg", by: "Dean", text: "Fixed the door" }, { src: "/data/2026/11/members/images/b.jpg", by: "Leo", text: "Plants", portrait: true }]
  const { html } = buildRecapEmail(r)
  expect(html.indexOf("hours</strong> of care")).toBeLessThan(html.indexOf("Shared in #contributions"))
  expect(html).toContain("/api/image-proxy?")
  expect(html).toContain('src="https://commonshub.brussels/images/events/osv-2027.png"')
  const known = { ...r, member: { id: "42", username: "x", name: "X" }, spentTotal: -0 }
  const out = buildRecapEmail(known)
  expect(out.html).not.toContain("−0")
  expect(out.text).toContain("· 0 tokens spent")
})

test("my contribution and my organisation's under the share covered, with Donate; no frame", () => {
  const r = communityOnlyRecap("Marianne", period, new Date("2026-12-01T09:00:00Z"))
  r.community = community
  r.contribution = { personal: 30, org: { name: "Acme SRL", amount: 250.5 } }
  const { html, text } = buildRecapEmail(r, { linkDiscord: "https://commonshub.brussels/link-discord?t=x" })
  expect(html.indexOf("fixed costs covered")).toBeLessThan(html.indexOf("My personal contribution"))
  expect(html).toContain("€30")
  expect(html).toContain("Acme SRL&#39;s contribution".replace("&#39;", "'"))
  expect(html).toContain("https://commonshub.brussels/donate")
  expect(html).toContain("discord-white.png")
  expect(html).not.toContain("border:1px solid #eaded9\">")
  expect(text).toContain("My personal contribution: €30")
})

test("one Transactions list: tokens in and out and euros, by date, signed from the member's side", async () => {
  const { transactions } = await import("@/lib/monthly-recap-email")
  const t = transactions({
    received: [{ at: Date.parse("2026-11-03T10:00:00Z"), what: "Park cleaning", amount: 1 } as never],
    spent: [{ at: Date.parse("2026-11-05T10:00:00Z"), what: "Coworking", amount: 3 } as never],
    euros: [{ at: Date.parse("2026-11-04T10:00:00Z"), amount: -50, description: "Membership" }, { at: Date.parse("2026-11-06T10:00:00Z"), amount: 12.5, description: "Refund" }],
  })
  expect(t.map((x) => [x.label, x.description])).toEqual([
    ["+1 token", "Park cleaning"],
    ["−€50", "Membership"],
    ["−3 tokens", "Coworking"],
    ["+€12.50", "Refund"],
  ])
})

test("mosaic photos open the month's carousel, with the reader's token", async () => {
  const { photoPageUrl } = await import("@/lib/monthly-recap-email")
  expect(photoPageUrl("/data/2026/11/public/images/1572229535276081232.jpg", "https://commonshub.brussels", "tok.sig")).toBe("https://commonshub.brussels/contributions/2026/11/photos?image=1572229535276081232&t=tok.sig")
  expect(photoPageUrl("https://cdn.discordapp.com/x.jpg")).toBe(null)
  const r = communityOnlyRecap("M", period)
  r.community = community
  r.photos = [{ src: "/data/2026/11/public/images/a1.jpg", by: "Dean", text: "x" }]
  expect(buildRecapEmail(r, { viewToken: "tok" }).html).toContain('href="https://commonshub.brussels/contributions/2026/11/photos?image=a1&amp;t=tok"')
})
