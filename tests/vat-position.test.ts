import { itemsLabel, subjectToVat, declaredInputVat, declaredSalesVat, directionOf, isIncome, redactDeclarant, returnOverdue, ruleFor, vatPosition } from "@/lib/vat-position"
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
    expect(ruleFor("expense", "reimbursement")).toMatchObject({ rate: "receipt", label: "Expenses reimbursed" })
    expect(ruleFor("expense", "bank_fees").rate).toBe("exempt")
    expect(ruleFor("expense", "travel").rate).toBe("receipt")
    expect(ruleFor("expense", "marketing").rate).toBe("21")
    expect(ruleFor("expense", "expense")).toMatchObject({ rate: "receipt", label: "Expenses reimbursed" }) // chb's slug
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
        tx("a", 121, "2024-06-02", "rental"),
        tx("a", 121, "2024-06-02", "rental"), // the same transaction filed twice
        { ...tx("m", 100, "2024-05-20", "grant"), counterpartyId: "x" }, // one swap paying out two amounts
        { ...tx("m", 200, "2024-05-20", "grant"), counterpartyId: "y" },
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
    expect(p.income.amount).toBe(1471)
    expect(p.income.vat).toBe(21)
    expect(p.income.groups.map((g) => [g.rate, g.amount, g.vat])).toEqual([
      ["21", 121, 21],
      ["outside", 1300, 0],
      ["unknown", 50, null],
    ])
    expect(p.expense.amount).toBe(1100)
    expect(p.expense.vat).toBe(21)
    expect(p.quarters.get("2024-Q2")).toEqual({ collected: 21, paid: 21 })
    expect(directionOf(tx("h", -5, "2024-01-01", "vat"))).toBeNull()
  })

  it("puts small categories together and lists large payments with a link", () => {
    const p = vatPosition(
      [
        tx("big", 3509, "2024-11-28", "rental", { accountSlug: "kbc" } as Partial<Transaction>),
        tx("r2", 500, "2024-10-01", "rental"),
        tx("d1", 15.5, "2024-12-01", "drinks"),
        tx("w1", 50, "2024-12-01", "equipment"),
        tx("ethereum:137:tx:0xabc", 2500, "2024-05-30", "grant", { accountSlug: "cw" } as Partial<Transaction>),
      ],
      [2024],
      (id) => (id.startsWith("ethereum:") ? `https://polygonscan.com/tx/${id.split(":")[3]}` : null),
    )
    const g21 = p.income.groups.find((g) => g.rate === "21")!
    expect(g21.lines.map((l) => [l.label, l.amount])).toEqual([
      ["Room rentals", 4009],
      ["Smaller amounts", 65.5],
    ])
    expect(g21.lines[1].why).toBe("Equipment sold (€50), Drinks (€16)")
    expect(g21.lines[0].items).toEqual([
      expect.objectContaining({ amount: 3509, date: "2024-11-28", explorer: null, href: "/2024/11/transactions/big" }),
    ])
    const grant = p.income.groups.find((g) => g.rate === "outside")!.lines[0]
    expect(grant.items[0]).toMatchObject({ explorer: "https://polygonscan.com/tx/0xabc", href: "/2024/05/transactions/0xabc" })
  })

  it("charges and deducts no VAT before our registration (1 May 2024), and expects no return before it", () => {
    const p = vatPosition([tx("a", 121, "2024-04-30", "rental"), tx("b", 121, "2024-05-01", "rental"), tx("c", -121, "2024-03-01", "services")], [2024])
    expect(p.income.groups.map((g) => [g.rate, g.amount, g.vat])).toEqual([
      ["21", 121, 21],
      ["before", 121, 0],
    ])
    expect(p.expense.vat).toBe(0)
    expect(subjectToVat(2024, 1)).toBe(false)
    expect(subjectToVat(2024, 2)).toBe(true)
    expect(returnOverdue(2023, 4, new Date("2026-11-14T00:00:00Z"))).toBe(false)
  })

  it("says how big the listed payments are", () => {
    expect(itemsLabel([35000, 20558.41])).toBe("2 payments of €20k or more")
    expect(itemsLabel([3509])).toBe("1 payment of €3,509")
    expect(itemsLabel([5000, 2019.68, 4000])).toBe("3 payments of €2k or more")
    expect(itemsLabel([])).toBe("")
  })

  it("shows a grant paid in tranches as one line with its document", () => {
    const groups = [{ id: "g", label: "Celo grant", document: { label: "Grant agreement", url: "https://x" }, txs: ["ethereum:137:tx:0xa", "ethereum:137:tx:0xb"] }]
    const p = vatPosition(
      [
        { ...tx("ethereum:137:tx:0xa", 1000, "2023-11-24", "grant"), counterpartyId: "1" },
        { ...tx("ethereum:137:tx:0xb", 500, "2024-05-30", "grant"), counterpartyId: "1" },
        { ...tx("ethereum:137:tx:0xb", 700, "2024-05-30", "grant"), counterpartyId: "2" },
        tx("c", 3000, "2024-06-01", "grant"),
      ],
      [2023, 2024],
      () => null,
      groups,
    )
    const items = p.income.groups.flatMap((g) => g.lines).flatMap((l) => l.items)
    const g = items.find((i) => i.group)!
    expect(g).toMatchObject({ amount: 2200, count: 3, date: "2023-11-24", group: { label: "Celo grant", until: "2024-05-30", document: { url: "https://x" } } })
    expect(items.filter((i) => !i.group).map((i) => i.amount)).toEqual([3000])
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
