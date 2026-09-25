import { describe, expect, test } from "@jest/globals"
import { isDonorName, rankDonors, tidyName } from "@/lib/donors"

describe("donor names", () => {
  test("all-caps bank names are tidied, mixed-case names kept as given", () => {
    expect(tidyName("DAMMAN XAVIER")).toBe("Damman Xavier")
    expect(tidyName("HAIDER-ABIDI S + N")).toBe("Haider-Abidi S + N")
    expect(tidyName("Greg minne Doa consulting")).toBe("Greg minne Doa consulting")
  })

  test("labels that stand in for a missing name are not donors", () => {
    for (const label of [
      "STRIPE",
      "Stripe",
      "0x0000000000000000000000000000000000000000",
      "(none)",
      "Donation",
      "Monthly financial contribution to Commons Hub Brussels (Support the Commons Hub (donation))",
      "Financial contribution to openletter",
    ]) {
      expect(isDonorName(label)).toBe(false)
    }
    expect(isDonorName("Reboot Democracy")).toBe(true)
    expect(isDonorName("Stripe Andersen")).toBe(true)
  })
})

describe("ranking donors", () => {
  const gifts = [
    { name: "All for climate", amount: 289.72, date: "2024-01-10" },
    { name: "All for climate", amount: 1706.76, date: "2024-01-20" },
    { name: "Reboot Democracy", amount: 35000, date: "2025-06-01" },
    { name: "LEUS LEONOOR", amount: 220, date: "2024-09-01" },
    { name: "Leus Leonoor", amount: 220, date: "2026-09-20" },
    { name: "STRIPE", amount: 789.72, date: "2026-09-21" },
    { name: "0x0000000000000000000000000000000000000000", amount: 5, date: "2026-09-22" },
  ]

  test("largest by total across all their gifts, one entry each", () => {
    const { largest } = rankDonors(gifts)
    expect(largest.map((d) => [d.name, d.total, d.donations])).toEqual([
      ["Reboot Democracy", 35000, 1],
      ["All for climate", 1996.48, 2],
      ["Leus Leonoor", 440, 2],
    ])
  })

  test("latest by their most recent gift", () => {
    const { latest } = rankDonors(gifts)
    expect(latest.map((d) => [d.name, d.lastAt])).toEqual([
      ["Leus Leonoor", "2026-09-20"],
      ["Reboot Democracy", "2025-06-01"],
      ["All for climate", "2024-01-20"],
    ])
  })
})

describe("one entry per person", () => {
  test("word order, case, accents and titles do not make a second donor", () => {
    const { largest } = rankDonors([
      { name: "HANQUIN MATHIEU", amount: 32.5, date: "2025-01-01" },
      { name: "Mathieu Hanquin", amount: 10, date: "2026-01-01" },
      { name: "Mr Thomas Suau", amount: 10, date: "2024-09-01" },
      { name: "SUAU THOMAS", amount: 5, date: "2024-10-01" },
      { name: "Timothée Blanc", amount: 5, date: "2024-10-01" },
      { name: "BLANC TIMOTHEE", amount: 5, date: "2024-11-01" },
    ])
    expect(largest.map((d) => [d.name, d.total, d.donations])).toEqual([
      ["Hanquin Mathieu", 42.5, 2],
      ["Thomas Suau", 15, 2],
      ["Timothée Blanc", 10, 2],
    ])
  })
})
