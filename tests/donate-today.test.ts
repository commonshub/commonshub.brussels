/**
 * /donate/screen counts the money the hub received today, live from Stripe
 * and Monerium: card payments and bank transfers in, never a Stripe payout
 * or the hub moving its own money, and the day starts at midnight in Brussels.
 */
import { describe, expect, test } from "@jest/globals"

import { brusselsStart, moneriumReceived, nameDonors, stripeReceived, summarise, type Received } from "@/lib/donate-today"
import type { MoneriumOrder } from "@/lib/monerium"

const HUB = "0xb01cCCE2d75d517EE520De31eAE6aFCa735aadc1"
const order = (o: Partial<MoneriumOrder> & { name?: string; iban?: string; at: string }): MoneriumOrder =>
  ({
    id: Math.random().toString(),
    kind: "issue",
    profile: "p",
    address: HUB,
    chain: "gnosis",
    currency: "eur",
    amount: "10",
    state: "processed",
    memo: "",
    counterpart: { identifier: { standard: "iban", iban: o.iban ?? "BE00 1234 5678 9012" }, details: { name: o.name ?? "Someone" } },
    meta: { placedAt: o.at, processedAt: o.at, txHashes: [] },
    ...o,
  }) as MoneriumOrder

describe("brusselsStart", () => {
  test("midnight in Brussels, summer and winter time", () => {
    expect(new Date(brusselsStart(new Date("2026-10-24T15:00:00Z"), "day")).toISOString()).toBe("2026-10-23T22:00:00.000Z")
    expect(new Date(brusselsStart(new Date("2026-10-25T15:00:00Z"), "day")).toISOString()).toBe("2026-10-24T22:00:00.000Z")
    expect(new Date(brusselsStart(new Date("2026-10-26T15:00:00Z"), "day")).toISOString()).toBe("2026-10-25T23:00:00.000Z")
    expect(new Date(brusselsStart(new Date("2026-10-25T15:00:00Z"), "month")).toISOString()).toBe("2026-09-30T22:00:00.000Z")
    // 00:30 in Brussels on the 1st is already the new day and month.
    expect(new Date(brusselsStart(new Date("2026-11-30T23:30:00Z"), "month")).toISOString()).toBe("2026-11-30T23:00:00.000Z")
  })
})

describe("stripeReceived", () => {
  test("card payments in euros, gross; not fees, refunds or adjustments", () => {
    const rs = stripeReceived([
      { type: "payment", reporting_category: "charge", amount: 500, currency: "eur", created: 1000, description: "Donation" },
      { type: "charge", reporting_category: "charge", amount: 1000, currency: "eur", created: 2000, description: "Subscription update" },
      { type: "charge", reporting_category: "charge", amount: 6050, currency: "eur", created: 3000, description: null },
      { type: "stripe_fee", reporting_category: "fee", amount: -10, currency: "eur", created: 3000, description: "Billing" },
      { type: "adjustment", reporting_category: "fee", amount: 93, currency: "eur", created: 3000, description: "Credit" },
      { type: "refund", reporting_category: "refund", amount: -500, currency: "eur", created: 3000, description: null },
    ] as Parameters<typeof stripeReceived>[0])
    expect(rs.map((r) => [r.amount, r.kind, r.via])).toEqual([
      [5, "donation", "card"],
      [10, "membership", "card"],
      [60.5, "payment", "card"],
    ])
  })
})

describe("moneriumReceived", () => {
  test("transfers into the hub's accounts; not Stripe payouts, its own KBC, other accounts or redemptions", () => {
    const rs = moneriumReceived([
      order({ at: "2026-10-25T10:00:00Z", amount: "42.35", memo: "Membership abc123" }),
      order({ at: "2026-10-25T11:00:00Z", amount: "1803.75", name: "STRIPE" }),
      order({ at: "2026-10-25T11:00:00Z", amount: "500", iban: "BE46 7340 7223 8636" }),
      order({ at: "2026-10-25T11:00:00Z", amount: "300", name: "Commons Hub Brussels ASBL" }),
      order({ at: "2026-10-25T11:00:00Z", amount: "70", address: "0x6fDF0AaE33E313d9C98D2Aa19Bcd8EF777912CBf" }),
      order({ at: "2026-10-25T11:00:00Z", amount: "70", kind: "redeem" }),
      order({ at: "2026-10-25T12:00:00Z", amount: "25", memo: "don pour le hub" }),
    ])
    expect(rs.map((r) => [r.amount, r.kind, r.via])).toEqual([
      [42.35, "membership", "bank transfer"],
      [25, "donation", "bank transfer"],
    ])
    expect(rs.every((r) => r.name === null)).toBe(true)
  })
})

describe("summarise", () => {
  const r = (iso: string, amount: number): Received => ({ at: Date.parse(iso), amount, via: "card", kind: "payment", name: null })
  test("today since midnight in Brussels, newest first; the rest of the month apart; totals add up to the cent", () => {
    const out = summarise(
      [r("2026-09-30T21:59:00Z", 999), r("2026-10-01T08:00:00Z", 100.1), r("2026-10-24T21:59:00Z", 50.2), r("2026-10-24T22:01:00Z", 0.1), r("2026-10-25T14:00:00Z", 0.2), r("2026-10-25T16:00:00Z", 7)],
      new Date("2026-10-25T15:00:00Z"),
    )
    expect(out.today.map((t) => t.amount)).toEqual([0.2, 0.1])
    expect(out.todayTotal).toBe(0.3)
    expect(out.monthBefore).toBe(150.3)
  })
})

describe("nameDonors", () => {
  test("a card donation takes the name its donor chose; nothing else does", () => {
    const at = Date.parse("2026-10-25T12:58:25Z")
    const rs = nameDonors(
      [
        { at, amount: 5, via: "card", kind: "donation", name: null },
        { at, amount: 5, via: "bank transfer", kind: "donation", name: null },
        { at, amount: 10, via: "card", kind: "membership", name: null },
      ],
      [
        { created: at / 1000 - 60, amount: 500, name: "Ana" },
        { created: at / 1000 - 60, amount: 1000, name: "Tom" },
      ],
    )
    expect(rs.map((x) => x.name)).toEqual(["Ana", null, null])
  })
})
