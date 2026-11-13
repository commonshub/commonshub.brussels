import { bucketOf, declaredSalesVat, expectedSalesVat, incomeByQuarter, isIncome, redactDeclarant, returnOverdue } from "@/lib/vat-position"
import type { VatPeriod } from "@/lib/taxes"
import type { Transaction } from "@/types/transactions"

const tx = (id: string, amount: number, date: string, category?: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, amount, currency: "EURe", type: "CREDIT", timestamp: Date.parse(`${date}T10:00:00Z`) / 1000, metadata: { category }, ...extra }) as Transaction

describe("vat-position", () => {
  it("sorts chb categories into the VAT buckets", () => {
    expect(bucketOf("rental")).toBe("rentals")
    expect(bucketOf("grant")).toBe("donations")
    expect(bucketOf("subsidy")).toBe("donations")
    expect(bucketOf("ticket")).toBe("tickets")
    expect(bucketOf("debt")).toBe("other")
    expect(bucketOf(undefined)).toBe("other")
  })

  it("counts only money coming in from outside", () => {
    expect(isIncome(tx("a", 10, "2024-05-01"))).toBe(true)
    expect(isIncome(tx("b", -10, "2024-05-01"))).toBe(false)
    expect(isIncome(tx("c", 10, "2024-05-01", undefined, { type: "INTERNAL" }))).toBe(false)
    expect(isIncome(tx("d", 10, "2024-05-01", "internal_transfer"))).toBe(false)
    expect(isIncome(tx("e", 10, "2024-05-01", undefined, { currency: "CHT" }))).toBe(false)
  })

  it("adds income per quarter once, on its Brussels date, and the VAT it carries", () => {
    const q = incomeByQuarter([
      tx("a", 121, "2024-04-02", "rental"),
      tx("a", 121, "2024-04-02", "rental"), // the same transaction filed twice
      tx("b", 1000, "2024-05-01", "donation"),
      tx("c", 50, "2024-06-01"),
      { ...tx("d", 242, "2024-06-30", "ticket"), timestamp: Date.parse("2024-06-30T22:30:00Z") / 1000 }, // 1 July in Brussels
    ])
    const q2 = q.get("2024-Q2")!
    expect(q2.byBucket.rentals).toBe(121)
    expect(q2.byBucket.donations).toBe(1000)
    expect(q2.other).toEqual({ "": 50 })
    expect(q2.total).toBe(1171)
    expect(expectedSalesVat(q2)).toBe(21)
    expect(q.get("2024-Q3")!.byBucket.tickets).toBe(242)
    expect(expectedSalesVat(q.get("2024-Q3"))).toBe(42)
  })

  it("reads the VAT declared on sales from grids 54 and 64", () => {
    expect(declaredSalesVat({ grids: { "54": 1898.73, "64": 69.99 } } as unknown as VatPeriod)).toBe(1828.74)
    expect(declaredSalesVat({ grids: {} } as unknown as VatPeriod)).toBe(0)
  })

  it("takes a return as overdue once the month after its quarter is over", () => {
    expect(returnOverdue(2026, 3, new Date("2026-10-31T12:00:00Z"))).toBe(false)
    expect(returnOverdue(2026, 3, new Date("2026-11-01T00:00:00Z"))).toBe(true)
    expect(returnOverdue(2026, 4, new Date("2027-02-01T00:00:00Z"))).toBe(true)
  })

  it("strips the filer's email and phone from a return", () => {
    const xml = "<Declarant><ns2:Name>CITIZEN SPRING</ns2:Name><ns2:EmailAddress>someone@example.org</ns2:EmailAddress><ns2:Phone>022</ns2:Phone></Declarant>"
    expect(redactDeclarant(xml)).toBe("<Declarant><ns2:Name>CITIZEN SPRING</ns2:Name></Declarant>")
  })
})
