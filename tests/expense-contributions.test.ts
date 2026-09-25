import { describe, expect, test } from "@jest/globals"
import { contributionMatcher } from "@/lib/expense-contributions"
import { billSlug } from "@/lib/contribute-expenses"

describe("contributions to an expense", () => {
  const booth = contributionMatcher({ slug: "furniture", label: "Furniture rental", short: "furniture", reference: "furniture" })
  const bill = contributionMatcher({ slug: billSlug("CHB-S/2026/09/0011"), label: "Plateau de Luxe", reference: "CHB-S/2026/09/0011" })

  test("recognised by the message people are asked to use, old and new", () => {
    expect(booth("Contribution furniture")).toBe(true)
    expect(booth("contribution Furniture rental")).toBe(true)
    expect(booth("Monthly contribution: Furniture rental")).toBe(true)
    expect(bill("Contribution CHB-S/2026/09/0011")).toBe(true)
    expect(bill("+++ Contribution chb-s-2026-09-0011")).toBe(true)
  })

  test("not a contribution to something else", () => {
    expect(booth("Contribution furnitures and more")).toBe(false)
    expect(booth("Furniture rental August 2026")).toBe(false)
    expect(bill("Contribution CHB-S/2026/09/00110")).toBe(false)
  })

  test("a bill's page is named after its accounting reference", () => {
    expect(billSlug("CHB-S/2026/09/0011")).toBe("chb-s-2026-09-0011")
    expect(billSlug("BILL/2025/Été")).toBe("bill-2025-ete")
  })
})
