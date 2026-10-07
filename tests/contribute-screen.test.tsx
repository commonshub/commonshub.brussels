/**
 * @jest-environment jsdom
 *
 * /contribute/screen is public and shown on the hub's TV: money (costs, the
 * latest donations) and time (photos from #contributions, who was thanked
 * lately), each with its date and time. No amount for anyone, a donor named
 * only as they chose at checkout, nothing from the members tier.
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import React from "react"
import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals"
import { render } from "@testing-library/react"

import { ContributeJars } from "@/components/screen/contribute-jars"
import { costLayers, hoursByKind, latestTransactions, monthIncome } from "@/lib/contribute-jars"
import {
  contributionPhotos,
  contributorsByTokens,
  lendersByLoan,
  recentContributors,
  recentDonations,
  recentTokenAwards,
  screenCosts,
  tokenReason,
  type ContributeScreenData,
} from "@/lib/contribute-screen"
import { thanksName } from "@/lib/donor-thanks"
import { relativeTime } from "@/components/screen/relative-time"
import type { DebtLedger } from "@/lib/debt"

const ledger = {
  holders: [
    { name: "Small Lender", minted: 500, burned: 0, balance: 500, firstAt: "2024-05-01", lastAt: "2024-05-01", transactions: 1 },
    { name: "Big Lender", minted: 10000, burned: 10000, balance: 0, firstAt: "2024-05-01", lastAt: "2025-01-01", transactions: 2 },
    { name: "Middle Lender SA", minted: 2416.11, burned: 0, balance: 2416.11, firstAt: "2024-06-01", lastAt: "2024-06-01", transactions: 1 },
    { name: "Burn Only", minted: 0, burned: 50, balance: -50, firstAt: "2024-06-01", lastAt: "2024-06-01", transactions: 1 },
  ],
  fetchedAt: "2026-10-04T08:00:00.000Z",
} as unknown as DebtLedger

jest.mock("@/lib/debt", () => ({
  ...(jest.requireActual("@/lib/debt") as object),
  loadDebtLedger: () => Promise.resolve(ledger),
}))

describe("ranking", () => {
  test("lenders by how much they lent in total, settled ones included, never by what is still owed", () => {
    expect(lendersByLoan(ledger.holders)).toEqual(["Big Lender", "Middle Lender SA", "Small Lender"])
  })

  test("time: tokens received summed over the years, latest name, bots and organisations left out", () => {
    const files = [
      {
        contributors: [
          { id: "1", profile: { username: "ann", name: "Ann (old name)" }, tokens: { in: 300, out: 0 } },
          { id: "2", profile: { username: "bob", name: "Bob" }, tokens: { in: 350, out: 0 } },
          { id: "9", profile: { username: "CommonsHub", name: "CommonsHub" }, tokens: { in: 999, out: 0 } },
        ],
      },
      {
        contributors: [
          { id: "1", profile: { username: "ann", name: "Ann" }, tokens: { in: 100, out: 0 } },
          { id: "3", profile: { username: "cy", name: "Cy" }, tokens: { in: 0, out: 20 } },
          { id: "4", profile: { username: "opencollective", name: "opencollective" }, tokens: { in: 50, out: 0 } },
        ],
      },
    ]
    expect(contributorsByTokens(files)).toEqual(["Ann", "Bob"])
  })
})

const T = 1790000000 // 2026-09-21, seconds
const tx = (over: object) => ({ provider: "stripe", currency: "EUR", type: "CREDIT", amount: 25, grossAmount: 25, timestamp: T, metadata: { category: "donation", collective: "commonshub" }, ...over })

describe("yang: donations", () => {
  test("only the hub's own donations, card or transfer, newest first; a name only when the donor chose one", () => {
    const txs = [
      tx({ timestamp: T }),
      tx({ timestamp: T + 100, amount: 10, grossAmount: 10 }),
      tx({ timestamp: T + 200, provider: "etherscan", currency: "EURe", type: "MINT", metadata: { category: "donation", collective: "commonshub" } }),
      tx({ timestamp: T + 300, metadata: { category: "donation", collective: "openletter" } }), // another collective
      tx({ timestamp: T + 400, metadata: { category: "membership", collective: "commonshub" } }), // not a donation
      tx({ timestamp: T + 500, provider: "kbcbrussels", metadata: { description: "Donation for the hub" } }),
      tx({ timestamp: T + 600, type: "DEBIT" }),
    ]
    const thanks = [
      { created: T - 120, amount: 2500, name: "Marie" }, // paid 2 min after opening the checkout
      { created: T + 50, amount: 1000, name: null }, // chose not to be named
    ]
    expect(recentDonations(txs, thanks)).toEqual([
      { at: (T + 500) * 1000, amount: 25, via: "bank transfer", name: null },
      { at: (T + 200) * 1000, amount: 25, via: "bank transfer", name: null },
      { at: (T + 100) * 1000, amount: 10, via: "card", name: null },
      { at: T * 1000, amount: 25, via: "card", name: "Marie" },
    ])
    // Without Stripe (no key), nobody is named.
    expect(recentDonations(txs, null).every((d) => d.name === null)).toBe(true)
  })

  test("the donor's choice: nothing, first name or full name", () => {
    expect(thanksName("anonymous", "Marie Curie")).toBeNull()
    expect(thanksName(undefined, "Marie Curie")).toBeNull()
    expect(thanksName("first", "  Marie   Curie ")).toBe("Marie")
    expect(thanksName("full", "Marie  Curie")).toBe("Marie Curie")
    expect(thanksName("full", "")).toBeNull()
  })
})

describe("yin: time", () => {
  test("who contributed lately: mentioned in #contributions, newest first, each once, bots left out", () => {
    const feed = {
      messages: [
        { timestamp: "2026-09-20T10:00:00Z", author: { id: "9", displayName: "Poster" }, mentions: [{ id: "1", displayName: "Ann" }, { id: "2", displayName: "Bob" }] },
        { timestamp: "2026-09-22T18:30:00Z", author: { id: "9", displayName: "Poster" }, mentions: [{ id: "1", displayName: "Ann" }, { id: "3", username: "CommonsHub" }] },
      ],
    }
    expect(recentContributors([feed], [])).toEqual([
      { names: ["Ann"], at: Date.parse("2026-09-22T18:30:00Z") },
      { names: ["Bob"], at: Date.parse("2026-09-20T10:00:00Z") },
    ])
  })

  test("tokens issued: grouped when the same reason and amount fall within the hour; described lines first", () => {
    const feed = {
      issued: [
        { timestamp: "2026-10-05T00:00:40Z", amount: 1, recipient: { id: "3", displayName: "Miriam" } },
        { timestamp: "2026-10-02T16:27:00Z", amount: 1, recipient: { id: "4", displayName: "Xavier" }, reason: "park cleaning" },
        { timestamp: "2026-10-02T16:21:42Z", amount: 1, recipient: { id: "5", displayName: "Marlene" }, reason: "Park cleaning" },
        { timestamp: "2026-10-02T16:21:40Z", amount: 1, recipient: { id: "6", displayName: "AlainV" }, reason: "Park cleaning" },
        { timestamp: "2026-10-02T16:10:00Z", amount: 2, recipient: { id: "7", displayName: "Jana" }, reason: "Park cleaning" }, // another amount
        { timestamp: "2026-10-02T06:30:00Z", amount: 3, recipient: { id: "1", displayName: "Leen" }, reason: "3h shift on 02/10/2026 at 08:30" },
        { timestamp: "2026-10-01T10:00:00Z", amount: 1, recipient: { id: "8", displayName: "Ralph" }, reason: "Park cleaning" }, // a day earlier
        { timestamp: "2026-10-03T11:00:00Z", amount: 2, recipient: null, reason: "Unknown wallet" },
      ],
    }
    expect(recentTokenAwards([feed], 3)).toEqual([
      { names: ["Xavier", "Marlene", "AlainV"], at: Date.parse("2026-10-02T16:27:00Z"), tokens: 1, reason: "Park cleaning" },
      { names: ["Jana"], at: Date.parse("2026-10-02T16:10:00Z"), tokens: 2, reason: "Park cleaning" },
      { names: ["Leen"], at: Date.parse("2026-10-02T06:30:00Z"), tokens: 3, reason: "3h shift on 2 Oct at 08:30" },
    ])
    // Undescribed awards only fill the list.
    expect(recentTokenAwards([feed], 5).map((g) => g.names.join())).toEqual(["Miriam", "Xavier,Marlene,AlainV", "Jana", "Leen", "Ralph"])
  })

  test("a reason fits one line: no thank-you opening, the first sentence, no @", () => {
    expect(tokenReason("Thank you to @Joy Tandt Pianiste for watering the plants. To @Dean and @Inge for the rest", "Joy Tandt Pianiste")).toBe("Watering the plants")
    expect(tokenReason("Park cleaning", "Marlene")).toBe("Park cleaning")
    expect(tokenReason("3h shift on 02/10/2026 at 08:30", "Leen")).toBe("3h shift on 2 Oct at 08:30")
    expect(tokenReason("Helping @Ann move chairs", "Bob")).toBe("Helping Ann move chairs")
    expect(tokenReason("", "Bob")).toBeUndefined()
    expect(tokenReason(undefined, "Bob")).toBeUndefined()
  })

  test("relative time", () => {
    const now = Date.parse("2026-10-05T12:00:00Z")
    expect(relativeTime(now - 20_000, now)).toBe("just now")
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago")
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3 hours ago")
    expect(relativeTime(now - 86_400_000, now)).toBe("yesterday")
    expect(relativeTime(now - 4 * 86_400_000, now)).toBe("4 days ago")
    // A week or more ago: the date.
    expect(relativeTime(Date.parse("2026-09-25T10:38:00Z"), now)).toBe("Fri 25 Sept")
  })

  test("until chb publishes the feed: who posted photos in #contributions", () => {
    const photo = (id: string, channelId: string, name: string, timestamp: string) => ({ id, channelId, timestamp, author: { id, username: name.toLowerCase(), displayName: name } }) as never
    const photos = [photo("1", "1297965144579637248", "Ann", "2026-09-20T10:00:00Z"), photo("2", "general", "Bob", "2026-09-21T10:00:00Z")]
    expect(recentContributors([], photos)).toEqual([{ names: ["Ann"], at: Date.parse("2026-09-20T10:00:00Z") }])
  })

  test("photos: only from #contributions, only the liked ones, a few at random", () => {
    const photo = (id: string, channelId: string, totalReactions: number) =>
      ({ id, url: `https://cdn/${id}.jpg`, proxyUrl: `/data/2026/09/public/images/${id}.jpg`, channelId, totalReactions, timestamp: "2026-09-20T10:00:00Z", author: { id: "1", username: "ann", displayName: "Ann" }, reactions: [], messageId: id }) as never
    const contributions = "1297965144579637248"
    const photos = [photo("1", contributions, 3), photo("2", contributions, 1), photo("3", "general", 9), photo("4", contributions, 2), photo("5", contributions, 5), photo("6", contributions, 4), photo("7", contributions, 2)]
    const picked = contributionPhotos(photos, { count: 4, random: () => 0.5 })
    expect(picked).toHaveLength(4)
    for (const p of picked) {
      expect(p.src).not.toMatch(/\/2\.jpg|\/3\.jpg/)
      expect(p).toMatchObject({ author: "Ann", at: Date.parse("2026-09-20T10:00:00Z") })
    }
  })
})

describe("what the page reads", () => {
  let dataDir: string
  const write = (rel: string, data: unknown) => {
    const file = path.join(dataDir, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data))
  }

  beforeAll(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "contribute-screen-"))
    // The public tier: display names chb publishes, donations without a name.
    write("2026/09/public/contributors.json", {
      contributors: [{ id: "1", address: "0xaaa", profile: { username: "ann", name: "Ann" }, tokens: { in: 10, out: 0 } }],
    })
    write("2026/09/public/transactions.json", {
      transactions: [
        tx({ amount: 5000, grossAmount: 5000 }),
      ],
    })
    write("2026/09/public/contributions.json", {
      messages: [{ timestamp: new Date((T + 60) * 1000).toISOString(), author: { id: "9", displayName: "Poster" }, mentions: [{ id: "1", displayName: "Ann" }] }],
    })
    // The members tier: names that must never reach a public page.
    write("2026/09/members/contributors.json", {
      contributors: [{ id: "5", address: "0xaaa", profile: { username: "secret", name: "Members Only Person" } }],
    })
    write("2026/09/members/transactions.json", {
      transactions: [{ ...tx({ amount: 50000 }), counterparty: "Secret Donor" }],
    })
  })

  afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }))

  async function load(): Promise<ContributeScreenData> {
    process.env.DATA_DIR = dataDir
    delete process.env.STRIPE_SECRET_KEY
    let data!: ContributeScreenData
    await jest.isolateModulesAsync(async () => {
      const { loadContributeScreen } = await import("@/lib/contribute-screen")
      data = await loadContributeScreen(new Date("2026-10-04T10:00:00Z"))
    })
    return data
  }

  test("public tier only: an unnamed donation with its amount, and Ann, each with when", async () => {
    const data = await load()
    expect(data.donations).toEqual([{ at: T * 1000, amount: 5000, via: "card", name: null }])
    expect(data.contributors).toEqual([{ names: ["Ann"], at: (T + 60) * 1000 }])
    expect(data.contributorsFrom).toBe("mentions")
    const json = JSON.stringify(data)
    for (const leak of ["Members Only Person", "Secret Donor", "50000"]) expect(json).not.toContain(leak)
  })

  test("the jars: costs in whole euros as layers, what this month covers adding up, donations with when", async () => {
    const data = await load()
    const costs = screenCosts([
      { slug: "rent", label: "Rent", amountEur: 6546.12 },
      { slug: "internet", label: "Internet", amountEur: 55 },
      { slug: "none", label: "Nothing", amountEur: 0 },
    ])
    expect(costs).toEqual([
      { slug: "rent", label: "Rent", amount: 6547 },
      { slug: "internet", label: "Internet", amount: 55 },
    ])
    const income = monthIncome({ categories: [{ slug: "membership", currencies: [{ currency: "EUR", in: 120, out: 20, net: 100 }] }, { slug: "donation", currencies: [{ currency: "EUR", in: 30.9, out: 0, net: 30.9 }] }] })
    const covered = income.reduce((sum, i) => sum + i.amount, 0)
    const jars = { layers: costLayers(costs, covered), total: 6602, income, covered, hours: [], hoursTotal: 0, lastMonthHours: 0, monthName: "October" }
    const money = [{ id: "d", at: data.donations[0].at, amount: 5000, slug: "donation", tag: "Donation", donation: { via: "card" as const, name: null } }]
    const { container } = render(<ContributeJars data={jars} money={money} time={[]} qrSvg="<svg></svg>" url="https://commonshub.brussels/contribute" />)
    const text = container.textContent ?? ""
    for (const part of ["€6,547", "€55", "€130 covered", "Memberships €100 · Donations €30", "+€5,000", "Donation", "by card", "Mon 21 Sept", "Fill a jar", "commonshub.brussels/contribute"])
      expect(text).toContain(part)
    for (const leak of ["Members Only Person", "Secret Donor", "50,000"]) expect(text).not.toContain(leak)
  })
})

describe("the jars", () => {
  test("money toward the space: memberships and donations received (net), bookings invoiced (without VAT); nothing else", () => {
    const income = monthIncome(
      {
        categories: [
          { slug: "internal_transfer", currencies: [{ currency: "EUR", in: 35000, out: 0, net: 35000 }] },
          { slug: "membership", currencies: [{ currency: "EUR", in: 105.5, out: 5.07, net: 100.43 }] },
          { slug: "donation", currencies: [{ currency: "EUR", in: 674.13, out: 19.88, net: 654.25 }] },
          // Paid bookings are counted when invoiced, not again when paid.
          { slug: "rental", currencies: [{ currency: "EUR", in: 300, out: 0, net: 300 }] },
          { slug: "rent", currencies: [{ currency: "EUR", in: 6546.76, out: 13226.62, net: -6679.86 }] },
        ],
      },
      {
        customers: [
          { incomeType: "room_rental", untaxedAmount: 935.5 },
          { incomeType: "sales_services", untaxedAmount: 381.5 },
          { incomeType: "membership", untaxedAmount: 266 },
          { incomeType: "drinks", untaxedAmount: 8.12 },
          { incomeType: "room_rental", untaxedAmount: null },
          { incomeType: "catering", untaxedAmount: 0.4 },
        ],
      },
    )
    expect(income).toEqual([
      { label: "Bookings", amount: 1317, invoiced: true }, // 935.5 + 381.5 + 0.4, in whole euros
      { label: "Donations", amount: 654 },
      { label: "Memberships", amount: 100 },
    ])
  })

  test("costs stack cheapest first; what is covered fills them from the bottom", () => {
    const layers = costLayers(
      [
        { slug: "rent", label: "Rent", amount: 600 },
        { slug: "internet", label: "Internet", amount: 100 },
        { slug: "power", label: "Electricity", amount: 300 },
      ],
      550,
    )
    expect(layers.map((l) => [l.slug, l.from, l.to, l.paid])).toEqual([
      ["internet", 0, 0.1, 100],
      ["power", 0.1, 0.4, 300],
      ["rent", 0.4, 1, 150],
    ])
  })

  test("hours by kind, one per token, from each token's reason", () => {
    const hours = hoursByKind({
      issued: [
        { timestamp: "2026-10-02T08:30:00Z", amount: 3, reason: "3h shift on 2 Oct" },
        { timestamp: "2026-10-02T10:00:00Z", amount: 1, reason: "park cleaning" },
        { timestamp: "2026-10-02T10:00:00Z", amount: 1, reason: "Park cleaning" },
        { timestamp: "2026-10-03T10:00:00Z", amount: 2, reason: null },
        { timestamp: "2026-10-03T10:00:00Z", amount: 0, reason: "nothing" },
      ],
    })
    expect(hours.map((h) => [h.kind, h.hours])).toEqual([
      ["shifts", 3],
      ["cleaning", 2],
      ["other", 2],
    ])
  })

  test("the latest transactions: the hub's money in and out, tagged; no internal moves, fees or other collectives; words only for money spent", () => {
    const tx = (id: string, timestamp: number, amount: number, category: string | undefined, description = "", extra: Record<string, unknown> = {}) => ({
      id,
      timestamp,
      amount,
      currency: "EURe",
      type: amount > 0 ? "MINT" : "BURN",
      metadata: { collective: "commonshub", category, description, ...extra },
    })
    const lines = latestTransactions(
      [
        tx("rent", 9, -6546.76, "rent", "Rent CHB October 2026"),
        tx("fee", 8, -0.1, "stripe_fee", "Billing - Usage Fee"),
        tx("move", 7, 10000, "internal_transfer"),
        tx("letter", 6, 10, "donation", "", { collective: "openletter" }),
        tx("don", 5, 2, "donation", "DAPHNE SARPYENER"),
        tx("booking", 4, 596.88, "rental", "+++000/0045/48892+++"),
        tx("furniture", 3, -441.65, "furniture", "CHB-S/2026/10/0001 - VENE1/2026/00108"),
        tx("unknown", 2, 105.88, undefined),
        tx("contractor", 1, -500, "consulting", "Website work"),
      ],
      new Map([["rent", "Rent"], ["donation", "Donation"], ["furniture", "Furniture and rented equipment"]]),
      [{ at: 5000, amount: 2, via: "bank transfer", name: null }],
      10,
    )
    expect(lines.map((l) => [l.id, l.amount, l.tag, l.note ?? ""])).toEqual([
      ["rent", -6546.76, "Rent", "Rent CHB October 2026"],
      ["don", 2, "Donation", ""],
      ["booking", 596.88, "Booking", ""],
      ["furniture", -441.65, "Furniture", ""],
      ["unknown", 105.88, "Uncategorised", ""],
      ["contractor", -500, "Contractor", "Website work"],
    ])
    expect(lines[1].donation).toEqual({ via: "bank transfer", name: null })

    // Three €10 memberships the same day, one after the other: one line.
    const grouped = latestTransactions([tx("m1", 1791300000, 10, "membership"), tx("m2", 1791290000, 10, "membership"), tx("m3", 1791280000, 10, "membership"), tx("d", 1791270000, 5, "donation")], new Map(), [], 10)
    expect(grouped.map((l) => [l.id, l.count ?? 1])).toEqual([
      ["m1", 3],
      ["d", 1],
    ])
  })

})
