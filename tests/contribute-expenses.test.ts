/**
 * @jest-environment node
 */
import settings from "@/settings/settings.json"
import fs from "fs"
import os from "os"
import path from "path"
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals"
import {
  classifyBills,
  findExpense,
  loadContributeExpenses,
  readMonthBills,
  recentMonths,
  withoutPersonName,
  type Bill,
} from "@/lib/contribute-expenses"

const CONFIG = {
  recurring: [
    { slug: "rent", label: "Rent", vendor: "XL Collective", title: "rent|subrent" },
    { slug: "furniture-relieve", label: "Furniture rental (Relieve)", vendor: "Relieve" },
    { slug: "internet", label: "Internet (Proximus)", vendor: "Proximus" },
    { slug: "electricity", label: "Electricity", line: "electricit" },
  ],
  exclude: {
    vendor: "mezze|pistolei",
    categories: ["catering-purchases"],
    title: "^reversal of|buffet",
  },
  oneTimeMonths: 12,
  oneTimeMinAmount: 20,
}

let nextId = 1
function bill(overrides: Partial<Bill> & { vendorName: string; totalAmount: number; date: string }): Bill {
  const id = nextId++
  const isCompany = overrides.vendorIsCompany ?? true
  return {
    id,
    title: `BILL/${id}`,
    state: "posted",
    refund: false,
    category: null,
    vendor: isCompany ? overrides.vendorName : "Individual supplier",
    vendorIsCompany: isCompany,
    reference: `BILL/${id}`,
    lines: [],
    ...overrides,
  }
}

describe("classifyBills", () => {
  const bills: Bill[] = [
    bill({ vendorName: "Relieve Group", totalAmount: 504.57, date: "2026-08-05", state: "draft" }),
    bill({ vendorName: "Relieve Group", totalAmount: 504.57, date: "2026-07-05" }),
    bill({ vendorName: "Relieve Group", totalAmount: 620, date: "2026-06-05" }),
    bill({ vendorName: "Relieve Group", totalAmount: 504.57, date: "2026-05-05" }),
    bill({ vendorName: "Proximus SA", totalAmount: 54.45, date: "2026-07-09", lines: ["[103] Business Internet"] }),
    bill({ vendorName: "XL Collective SRL", totalAmount: 6176, date: "2026-01-01", lines: ["Subrent"] }),
    bill({ vendorName: "XL Collective SRL", totalAmount: 3000, date: "2026-02-01", lines: ["Consulting"] }),
    bill({ vendorName: "Coolblue", totalAmount: 746, date: "2026-03-09", lines: ["Dishwasher"] }),
    bill({ vendorName: "Mezze Way", totalAmount: 900, date: "2026-03-10", lines: ["Lunch for 40"] }),
    bill({ vendorName: "Jane Doe", vendorIsCompany: false, totalAmount: 371, date: "2026-04-14", lines: ["Salad buffet"] }),
    bill({ vendorName: "Big Bag", totalAmount: 300, date: "2026-04-15", category: "catering-purchases" }),
    bill({ vendorName: "KBC", totalAmount: 1.67, date: "2026-06-30", lines: ["Account statement"] }),
    bill({ vendorName: "DAPPNODE", totalAmount: 2150, date: "2026-07-26", refund: true, title: "Reversal of duplicate" }),
    bill({ vendorName: "Hetzner", totalAmount: 49.23, date: "2026-06-01", state: "draft" }),
    bill({ vendorName: "Festi", totalAmount: 198.26, date: "2026-04-10", lines: ["?"] }),
    bill({ vendorName: "", totalAmount: 165.37, date: "2026-07-18", lines: ["Electricité"] }),
  ].sort((a, b) => (a.date < b.date ? 1 : -1))

  const result = classifyBills(bills, CONFIG)

  test("recurring amounts are the typical bill, posted bills first, drafts still count", () => {
    const relieve = result.recurring.find((e) => e.slug === "furniture-relieve")!
    expect(relieve.amountEur).toBe(504.57)
    expect(relieve.date).toBe("2026-08-05")
    expect(relieve.billCount).toBe(3)
    expect(relieve.vendor).toBe("Relieve Group")
  })

  test("rent is only the landlord's rent bills, not their other invoices", () => {
    const rent = result.recurring.find((e) => e.slug === "rent")!
    expect(rent.amountEur).toBe(6176)
    const consulting = result.oneTime.find((e) => e.label === "Consulting")
    expect(consulting?.vendor).toBe("XL Collective SRL")
  })

  test("a recurring rule with no bills is left out rather than shown at zero", () => {
    expect(result.recurring.map((e) => e.slug)).toEqual(["rent", "furniture-relieve", "internet", "electricity"])
    const none = classifyBills([], CONFIG)
    expect(none.recurring).toEqual([])
    expect(none.empty).toBe(true)
  })

  test("catering is excluded by vendor, by category and by what the bill says", () => {
    const labels = result.oneTime.map((e) => e.label)
    expect(labels).not.toContain("Lunch for 40")
    expect(labels).not.toContain("Salad buffet")
    expect(result.oneTime.find((e) => e.vendor === "Big Bag")).toBeUndefined()
  })

  test("refunds, reversals, drafts and bank fees never become an expense", () => {
    const vendors = result.oneTime.map((e) => e.vendor)
    expect(vendors).not.toContain("DAPPNODE")
    expect(vendors).not.toContain("KBC")
    expect(vendors).not.toContain("Hetzner")
  })

  test("one-time expenses carry the bill reference in their transfer message", () => {
    const dishwasher = result.oneTime.find((e) => e.label === "Dishwasher")!
    expect(dishwasher.slug).toMatch(/^bill-\d+$/)
    expect(dishwasher.message).toBe(`Contribution ${dishwasher.reference} - Dishwasher`)
    expect(dishwasher.amountEur).toBe(746)
  })

  test("a bill with no usable line falls back to the vendor", () => {
    const festi = result.oneTime.find((e) => e.vendor === "Festi")!
    expect(festi.label).toMatch(/^Festi bill /)
  })

  test("individuals are never named", () => {
    for (const e of [...result.recurring, ...result.oneTime]) {
      expect(e.vendor).not.toBe("Jane Doe")
    }
  })

  test("a rule on the line text works without any vendor name", () => {
    const electricity = result.recurring.find((e) => e.slug === "electricity")!
    expect(electricity.amountEur).toBe(165.37)
    expect(electricity.vendor).toBe("Electricity")
  })

  test("findExpense looks across both lists", () => {
    expect(findExpense("internet", result)?.label).toBe("Internet (Proximus)")
    expect(findExpense("nope", result)).toBeNull()
  })
})

describe("withoutPersonName", () => {
  test("drops the person's name from what they bought", () => {
    expect(withoutPersonName("Jane Doe: Batteries", "Jane Doe")).toBe("Batteries")
    expect(withoutPersonName("Groceries for Zero Waste event - Jane Doe", "Jane Doe")).toBe(
      "Groceries for Zero Waste event",
    )
    expect(withoutPersonName("Doe Action - towels, plates", "Jane Doe")).toBe("Action - towels, plates")
    expect(withoutPersonName("Client: Citizen Spring. Contact: Sam Roe. Ref: OSV", "Jane Doe")).toBe(
      "Client: Citizen Spring. Ref: OSV",
    )
  })

  test("leaves lines without the name alone", () => {
    expect(withoutPersonName("Postmark - 2026-04-07", "Jane Doe")).toBe("Postmark - 2026-04-07")
    expect(withoutPersonName("Consulting", "")).toBe("Consulting")
  })
})

describe("reading the dataset", () => {
  let dataDir: string

  // chb's public-tier projection: the partner is inline for companies.
  beforeAll(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "contribute-"))
    const root = path.join(dataDir, "2026", "07", "public")
    fs.mkdirSync(root, { recursive: true })
    fs.writeFileSync(
      path.join(root, "bills.json"),
      JSON.stringify({
        bills: [
          {
            id: 1,
            title: "7604598980",
            state: "posted",
            date: "2026-07-09",
            totalAmount: 54.45,
            moveType: "in_invoice",
            ref: "7604598980",
            partner: { id: 1571, displayName: "Proximus SA de droit public", isCompany: true },
            lineItems: [
              { title: "[103] Business Internet Mega Fiber", displayType: "product" },
              { title: "Note", displayType: "line_note" },
            ],
          },
          { id: 2, title: "unnamed", state: "posted", date: "2026-07-10", totalAmount: 10 },
        ],
      }),
    )
  })

  afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }))

  test("reads the public tier, partner inline when the projection carries it", () => {
    const bills = readMonthBills(dataDir, "2026", "07")!
    expect(bills).toHaveLength(2)
    expect(bills[0]).toMatchObject({
      vendor: "Proximus SA de droit public",
      reference: "7604598980",
      lines: ["Business Internet Mega Fiber"],
    })
    expect(bills[1]).toMatchObject({ vendor: "", reference: "unnamed" })
  })

  test("never reads the provider archive", () => {
    const archive = path.join(dataDir, "2026", "04", "providers", "odoo", "commonshub")
    fs.mkdirSync(archive, { recursive: true })
    fs.writeFileSync(path.join(archive, "bills.json"), JSON.stringify({ bills: [{ id: 3, title: "x", state: "posted", date: "2026-04-01", totalAmount: 1 }] }))
    expect(readMonthBills(dataDir, "2026", "04")).toBeNull()
  })

  test("a month with no export is skipped, not an error", () => {
    expect(readMonthBills(dataDir, "2026", "06")).toBeNull()
    const expenses = loadContributeExpenses({ dataDir, now: new Date("2026-08-15T12:00:00Z"), config: CONFIG })
    expect(expenses.recurring.map((e) => e.slug)).toEqual(["internet"])
    expect(expenses.oneTime).toEqual([])
  })

  test("a bill without a partner still yields its expense, unnamed", () => {
    const root = path.join(dataDir, "2026", "05", "public")
    fs.mkdirSync(root, { recursive: true })
    fs.writeFileSync(
      path.join(root, "bills.json"),
      JSON.stringify({
        bills: [
          { id: 9, title: "708733797986", state: "posted", date: "2026-05-18", totalAmount: 165.37, lineItems: [{ title: "Electricité" }] },
        ],
      }),
    )
    const bills = readMonthBills(dataDir, "2026", "05")!
    expect(bills).toHaveLength(1)
    expect(bills[0].vendor).toBe("")
    expect(bills[0].reference).toBe("708733797986")
    const expenses = loadContributeExpenses({ dataDir, now: new Date("2026-08-15T12:00:00Z"), config: CONFIG })
    expect(expenses.recurring.map((e) => e.slug)).toEqual(["internet", "electricity"])
  })

  test("recentMonths walks back across a year boundary", () => {
    expect(recentMonths(new Date("2026-02-10T00:00:00Z"), 3)).toEqual([
      { year: "2026", month: "02" },
      { year: "2026", month: "01" },
      { year: "2025", month: "12" },
    ])
  })
})

describe("the fixed costs configured in settings", () => {
  // chb does not publish a bills projection in the public tier yet, so on
  // production the page reads no bills at all. Every fixed cost must still
  // show, with the amount configured for it.
  test("all appear with their monthly amount even when no bill is readable", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "contribute-empty-"))
    try {
      const config = (settings as unknown as { contribute: typeof CONFIG }).contribute
      const { recurring } = loadContributeExpenses({ dataDir: empty, now: new Date("2026-09-23T12:00:00Z"), config })
      expect(recurring.map((e) => [e.slug, e.amountEur])).toEqual([
        ["rent", 6546.76],
        ["furniture-relieve", 504.57],
        ["acoustic-booth-wenap", 133.1],
        ["internet", 54.45],
        ["electricity", 238.5],
      ])
      const total = recurring.reduce((sum, e) => sum + e.amountEur, 0)
      expect(Math.round(total * 100) / 100).toBe(7477.38)
    } finally {
      fs.rmSync(empty, { recursive: true, force: true })
    }
  })
})
