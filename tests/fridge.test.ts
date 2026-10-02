import { describe, expect, test } from "@jest/globals"
import { drinksFromLines, loadLatestDelivery, orderCost, orderSummary, publicName, suggestedPrice } from "@/lib/fridge"

// The Big Bag delivery of 30 September 2026, as the bill lists it.
const L = (description: string, quantity: number, totalAmount: number) => ({ description: `${description}\n${description.replace(/^\[\w+\]\s*/, "")}`, quantity, totalAmount })
const DELIVERY = [
  L("[5025] Pajottenlander Orange Bio (Casier de 6 x 75cl)", 1, 25.61),
  L("[1579] Vidanges 3,50", 1, 3.5),
  L("[4504] Fritz Limo Citron (Casier de 24 x 33cl)", 3, 96.51),
  L("[4503] Vidanges 3,42", 3, 10.26),
  L("[3510] Sucre Blanc en sticks Delahaut 1000p", 1, 25.85),
  L("[5690] Lait d'Ardennes entier (6 x 1L Tetra)", 1, 8.51),
  L("[2133] Zinnebir 5,8% (Casier de 24 x 33cl)", 3, 104.69),
  L("[4853] Trottinette Ipa Bio 0,4% - DrinkDrink! (Casier de 24 x 33cl)", 2, 72.57),
  L("[4910] Pajottenlander Pomme Jus Bio (Casier de 6 x 1L)", 1, 18.31),
  L("[4503] Vidange - Vidanges 3,42", -4, -13.68),
]
const config = { vendor: "big ?bag|delivco", crate: "\\((?:casier|bac|pack)\\s+de\\s+(\\d+)\\s*x\\s*([\\d.,]+\\s*c?l)\\)", roundTo: 0.5, minimum: 1.5, timeTokensPerMonth: 1, transferMessage: "Contribution fridge", crateTransferMessage: "Contribution fridge crate" }

describe("what is in the fridge", () => {
  test("one drink per crate line; deposits, returns, milk and sugar left out", () => {
    const drinks = drinksFromLines(DELIVERY, config)
    expect(drinks.map((d) => [d.name, d.size, d.bottles, d.costPerBottle, d.crateCost, d.abv ?? null, d.suggested])).toEqual([
      ["Fritz Limo Citron", "33cl", 72, 1.34, 32.16, null, 1.5],
      ["Pajottenlander Orange Bio", "75cl", 6, 4.27, 25.62, null, 4.5],
      ["Pajottenlander Pomme Jus Bio", "1L", 6, 3.05, 18.3, null, 3.5],
      ["Trottinette Ipa Bio 0,4%", "33cl", 48, 1.51, 36.24, 0.4, 2],
      ["Zinnebir 5,8%", "33cl", 72, 1.45, 34.8, 5.8, 1.5],
    ])
  })

  test("the same product on two lines is one drink", () => {
    const drinks = drinksFromLines([L("[2133] Zinnebir 5,8% (Casier de 24 x 33cl)", 1, 34.9), L("[2133] Zinnebir 5,8% (Casier de 24 x 33cl)", 2, 69.79)], config)
    expect(drinks).toHaveLength(1)
    expect(drinks[0]).toMatchObject({ bottles: 72, costPerBottle: 1.45 })
  })

  test("suggested amount: the cost rounded up, never under the minimum", () => {
    expect(suggestedPrice(1.34, config)).toBe(1.5)
    expect(suggestedPrice(1.5, config)).toBe(1.5)
    expect(suggestedPrice(1.51, config)).toBe(2)
    expect(suggestedPrice(0.6, config)).toBe(1.5)
  })

  test("an order reads as a short line", () => {
    const [fritz, , , , zinne] = drinksFromLines(DELIVERY, config)
    expect(orderSummary([{ drink: zinne, quantity: 2 }, { drink: fritz, quantity: 1 }, { drink: fritz, quantity: 0 }])).toBe("2× Zinnebir 5,8%, 1× Fritz Limo Citron")
  })
})

describe("costs and names", () => {
  test("what a selection cost us, to the cent", () => {
    const drinks = drinksFromLines(DELIVERY, config)
    const zinne = drinks.find((d) => d.name.startsWith("Zinnebir"))!
    const fritz = drinks.find((d) => d.name === "Fritz Limo Citron")!
    expect(orderCost([{ drink: zinne, quantity: 2 }, { drink: fritz, quantity: 1 }])).toBe(4.24)
  })

  test("a name to be listed under: plain, short, no links", () => {
    expect(publicName("  Alice   Dupont ")).toBe("Alice Dupont")
    expect(publicName("")).toBeNull()
    expect(publicName("x")).toBeNull()
    expect(publicName("buy cheap pills at spam.com")).toBeNull()
    expect(publicName("me@example.org")).toBeNull()
    expect(publicName("a".repeat(41))).toBeNull()
    expect(publicName(42)).toBeNull()
  })
})

describe("loadLatestDelivery", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path")
  const write = (dir: string, file: string, data: unknown) => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, file), JSON.stringify(data))
  }
  const vendor = { id: "p-00c888a09d", type: "organisation", name: "DelivCo SRL (Big Bag Delivery)" }

  test("reads the year expenses.json, newest year first; bills only, from the fridge vendor", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fridge-"))
    write(path.join(root, "2025", "public"), "expenses.json", {
      expenses: [{ number: "OLD", kind: "bill", date: "2025-12-12", vendor, lines: [L("[2133] Zinnebir 5,8% (Casier de 24 x 33cl)", 1, 34.9)] }],
    })
    write(path.join(root, "2026", "public"), "expenses.json", {
      expenses: [
        { number: "CN", kind: "credit_note", date: "2026-09-30", vendor, lines: [L("[2133] Zinnebir 5,8% (Casier de 24 x 33cl)", 1, 34.9)] },
        { number: "OTHER", kind: "bill", date: "2026-09-29", vendor: { type: "organisation", name: "Colruyt" }, lines: [L("[1] Cola (Casier de 24 x 33cl)", 1, 20)] },
        { number: "CHB-S/2026/09/0013", kind: "bill", date: "2026-09-30", vendor, lines: DELIVERY },
        { number: "CHB-S/2026/08/0002", kind: "bill", date: "2026-08-14", vendor, lines: DELIVERY },
      ],
    })
    const delivery = loadLatestDelivery(config, root)
    expect(delivery?.number).toBe("CHB-S/2026/09/0013")
    expect(delivery?.drinks.map((d) => d.name)).toContain("Zinnebir 5,8%")
    fs.rmSync(root, { recursive: true, force: true })
  })

  test("a year with no delivery falls through to the previous one", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fridge-"))
    write(path.join(root, "2025", "public"), "expenses.json", {
      expenses: [{ number: "OLD", kind: "bill", date: "2025-12-12", vendor, lines: [L("[2133] Zinnebir 5,8% (Casier de 24 x 33cl)", 1, 34.9)] }],
    })
    write(path.join(root, "2026", "public"), "expenses.json", { expenses: [] })
    expect(loadLatestDelivery(config, root)?.number).toBe("OLD")
    fs.rmSync(root, { recursive: true, force: true })
  })
})
