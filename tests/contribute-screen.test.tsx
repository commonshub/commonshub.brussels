/**
 * @jest-environment jsdom
 *
 * /contribute/screen is public and shown on the hub's TV: a cloud of the
 * names of those who gave money or time, shuffled by day (not a scoreboard),
 * without any amount, and no name the site does not already show to
 * anonymous visitors.
 */
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import React from "react"
import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals"
import { render } from "@testing-library/react"

import { ContributeBoard } from "@/components/screen/contribute-board"
import { contributorsByTokens, lendersByLoan, type ContributeScreenData } from "@/lib/contribute-screen"
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

describe("what the page reads", () => {
  let dataDir: string
  const write = (rel: string, data: unknown) => {
    const file = path.join(dataDir, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data))
  }

  beforeAll(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "contribute-screen-"))
    // The public tier: display names chb publishes, and donations without a name.
    write("2026/public/contributors.json", {
      generatedAt: "2026-10-03T23:00:48Z",
      contributors: [{ id: "1", profile: { username: "ann", name: "Ann" }, tokens: { in: 10, out: 0 } }],
    })
    write("2026/09/public/transactions.json", {
      transactions: [{ amount: 50, timestamp: 1790000000, counterparty: null, metadata: { category: "donation", collective: "commonshub" } }],
    })
    // The members tier: names that must never reach a public page.
    write("2026/members/contributors.json", {
      contributors: [{ id: "5", profile: { username: "secret", name: "Members Only Person" }, tokens: { in: 9999, out: 0 } }],
    })
    write("2026/09/members/transactions.json", {
      transactions: [{ amount: 50000, timestamp: 1790000000, counterparty: "Secret Donor", metadata: { category: "donation", collective: "commonshub" } }],
    })
  })

  afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }))

  async function load(): Promise<ContributeScreenData> {
    process.env.DATA_DIR = dataDir
    let data!: ContributeScreenData
    await jest.isolateModulesAsync(async () => {
      const { loadContributeScreen } = await import("@/lib/contribute-screen")
      data = await loadContributeScreen()
    })
    return data
  }

  test("only public names, only names: no member-tier name, no amount", async () => {
    const data = await load()
    expect(data.lenders).toEqual(["Big Lender", "Middle Lender SA", "Small Lender"])
    expect(data.contributors).toEqual(["Ann"])
    expect(data.donations).toBe(1)
    expect(data.updatedAt).toBe("2026-10-04T08:00:00.000Z")
    const json = JSON.stringify(data)
    for (const leak of ["Members Only Person", "Secret Donor", "10000", "2416", "9999", "50000"]) expect(json).not.toContain(leak)
  })

  test("the board shows every name once, as a cloud: no ranks, no numbers, no amount", async () => {
    const data = await load()
    const { container } = render(<ContributeBoard data={data} qrSvg="<svg></svg>" url="https://commonshub.brussels/contribute" seed="2026-10-04" />)
    const text = container.textContent ?? ""
    for (const name of ["Big Lender", "Middle Lender SA", "Small Lender", "Ann"]) expect(text).toContain(name)
    expect(container.querySelector("ol")).toBeNull()
    expect(text).toContain("Contribute!")
    expect(text).toContain("commonshub.brussels/contribute")
    expect(text).not.toMatch(/€|EUR|tokens? ?\d|\d[\d\s.,]*\s?(€|CHT)/)
    for (const leak of ["Members Only Person", "Secret Donor", "10,000", "10 000", "2,416", "500"]) expect(text).not.toContain(leak)
  })

  test("the cloud is shuffled by day, each name once, whatever the ranking", async () => {
    const { cloudNames } = await import("@/lib/contribute-screen")
    const lists = { lenders: ["A", "B", "C", "D", "E", "F"], contributors: ["f", "G", "H", "I"] }
    const day1 = cloudNames(lists, "2026-10-04").map((n) => n.name)
    expect(day1).toHaveLength(9) // "f" is "F" again
    expect(new Set(day1).size).toBe(9)
    expect(cloudNames(lists, "2026-10-04").map((n) => n.name)).toEqual(day1)
    expect(cloudNames(lists, "2026-10-05").map((n) => n.name)).not.toEqual(day1)
  })
})
