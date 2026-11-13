import { declaredInputVat, declaredSalesVat, directionOf, isIncome, redactDeclarant, returnOverdue, ruleFor, vatPosition } from "@/lib/vat-position"
import type { VatPeriod } from "@/lib/taxes"
import type { Transaction } from "@/types/transactions"

const tx = (id: string, amount: number, date: string, category?: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, amount, currency: "EURe", type: "CREDIT", timestamp: Date.parse(`${date}T10:00:00Z`) / 1000, metadata: { category }, ...extra }) as Transaction

describe("vat-position", () => {
  it("gives each category a VAT rate and a reason", () => {
    expect(ruleFor("income", "rental").rate).toBe("21")
    expect(ruleFor("income", "membership").rate).toBe("exempt")
    expect(ruleFor("income", "grant").rate).toBe("outside")
    expect(ruleFor("income", "debt").rate).toBe("outside")
    expect(ruleFor("expense", "rent").rate).toBe("exempt")
    expect(ruleFor("expense", "salaries").rate).toBe("outside")
    expect(ruleFor("income", undefined)).toMatchObject({ rate: "unknown", label: "Not categorised yet" })
    expect(ruleFor("income", "mystery")).toMatchObject({ rate: "unknown", label: "mystery" })
    expect(ruleFor("income", "debt", "eurb")).toMatchObject({ rate: "unknown", category: "debt:eurb" })
    expect(ruleFor("income", "debt", "brusselspay").category).toBe("debt")
    expect(ruleFor("income", "other-income").rate).toBe("21")
    expect(ruleFor("income", "sponsoring").rate).toBe("unknown")
    for (const r of [ruleFor("income", "ticket"), ruleFor("expense", "insurance")]) expect(r.why.length).toBeGreaterThan(10)
  })

  it("counts only money coming in from outside", () => {
    expect(isIncome(tx("a", 10, "2024-05-01"))).toBe(true)
    expect(isIncome(tx("b", -10, "2024-05-01"))).toBe(false)
    expect(isIncome(tx("c", 10, "2024-05-01", undefined, { type: "INTERNAL" }))).toBe(false)
    expect(isIncome(tx("d", 10, "2024-05-01", "internal_transfer"))).toBe(false)
    expect(isIncome(tx("e", 10, "2024-05-01", undefined, { currency: "CHT" }))).toBe(false)
  })

  it("adds up income and expenses by rate, once each, on the Brussels date", () => {
    const p = vatPosition(
      [
        tx("a", 121, "2024-04-02", "rental"),
        tx("a", 121, "2024-04-02", "rental"), // the same transaction filed twice
        tx("b", 1000, "2024-05-01", "donation"),
        tx("c", 50, "2024-06-01"),
        { ...tx("d", 242, "2024-12-31", "ticket"), timestamp: Date.parse("2024-12-31T23:30:00Z") / 1000 }, // 1 Jan 2025 in Brussels
        tx("e", -121, "2024-05-02", "services"),
        tx("f", -1000, "2024-05-02", "rent"),
        tx("g", 7786.19, "2024-12-10", "vat"), // a VAT refund is not income
        tx("i", 5000, "2024-06-01", "loan"), // financing
        tx("j", 300, "2024-06-01", "third-party"), // held for someone else, hyphenated as in tags
        tx("k", 21, "2024-06-03", "refund"), // brings expenses down
      ],
      [2023, 2024],
    )
    expect(p.income.amount).toBe(1171)
    expect(p.income.vat).toBe(21)
    expect(p.income.groups.map((g) => [g.rate, g.amount, g.vat])).toEqual([
      ["21", 121, 21],
      ["outside", 1000, 0],
      ["unknown", 50, null],
    ])
    expect(p.expense.amount).toBe(1100)
    expect(p.expense.vat).toBe(21)
    expect(p.quarters.get("2024-Q2")).toEqual({ collected: 21, paid: 21 })
    expect(directionOf(tx("h", -5, "2024-01-01", "vat"))).toBeNull()
  })

  it("reads the VAT declared on sales from grids 54 and 64", () => {
    expect(declaredSalesVat({ grids: { "54": 1898.73, "64": 69.99 } } as unknown as VatPeriod)).toBe(1828.74)
    expect(declaredSalesVat({ grids: {} } as unknown as VatPeriod)).toBe(0)
    expect(declaredInputVat({ grids: { "59": 647.98 } } as unknown as VatPeriod)).toBe(647.98)
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
