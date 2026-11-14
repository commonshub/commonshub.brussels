import { vatPosition } from "@/lib/vat-position"
import { LINES, WINBOOKS, compareWithWinbooks } from "@/lib/winbooks-2023-2024"
import type { Transaction } from "@/types/transactions"

const tx = (id: string, amount: number, date: string, category?: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, amount, currency: "EURe", type: "CREDIT", timestamp: Date.parse(`${date}T10:00:00Z`) / 1000, metadata: { category }, ...extra }) as Transaction

const round = (n: number) => Math.round(n * 100) / 100

describe("winbooks 2023-2024", () => {
  it("splits all of WinBooks' income and expenses over the lines", () => {
    const income = round(LINES.filter((l) => l.direction === "income").reduce((s, l) => s + l.winbooks.amount, 0))
    const expense = round(LINES.filter((l) => l.direction === "expense").reduce((s, l) => s + l.winbooks.amount, 0))
    expect(income).toBe(WINBOOKS.income)
    expect(expense).toBe(round(WINBOOKS.expenseNet + WINBOOKS.expenseVat))
  })

  it("gives each line's categories to that line only", () => {
    for (const dir of ["income", "expense"] as const) {
      const cats = LINES.filter((l) => l.direction === dir).flatMap((l) => l.categories.filter((c) => c !== "*"))
      expect(new Set(cats).size).toBe(cats.length)
    }
  })

  it("totals each category over the VAT registration date", () => {
    const p = vatPosition([tx("a", 121, "2024-04-30", "rental"), tx("b", 121, "2024-05-01", "rental"), tx("c", -50, "2024-06-01", "services")], [2024])
    expect(p.byCategory.income.get("rental")).toMatchObject({ amount: 242, vat: 21, count: 2 })
    expect(p.byCategory.expense.get("services")).toMatchObject({ amount: 50, count: 1 })
  })

  it("compares line by line and keeps what no reason covers", () => {
    const p = vatPosition(
      [
        tx("t", 1210, "2024-06-01", "ticket"),
        tx("d", 1000, "2024-06-01", "donation"),
        tx("u", 3000, "2024-08-06", undefined),
        tx("x", 70, "2024-06-01", "mystery"),
        tx("e", -100, "2024-06-01", "services"),
      ],
      [2024],
    )
    const c = compareWithWinbooks(p)
    const line = (key: string) => c.lines.find((l) => l.line.key === key)!

    // Tickets are compared without their VAT, and that VAT is one of the reasons.
    const tickets = line("tickets")
    expect(tickets.page).toBe(1000)
    expect(tickets.reasons.find((r) => r.theme === "vat")?.amount).toBe(210)
    expect(tickets.unexplained).toBe(round(tickets.difference - tickets.reasons.reduce((s, r) => s + r.amount, 0)))

    // The City of Brussels subsidy counts as a reason only while the page has it uncategorised.
    expect(line("funding").reasons.some((r) => r.amount === 3000)).toBe(true)
    expect(line("uncategorised").reasons.find((r) => r.amount === -3000)).toBeDefined()
    expect(line("uncategorised").unexplained).toBe(0)

    // A category no line names still counts, so the totals always add up.
    expect(line("other-income").page).toBe(70)
    expect(c.income.page).toBe(round(p.income.amount - p.income.vat))
    expect(c.expense.page).toBe(p.expense.amount)
    expect(round(c.lines.reduce((s, l) => s + l.unexplained, 0))).toBe(c.unexplained)
  })
})
