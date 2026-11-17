import { renderToStaticMarkup } from "react-dom/server"

const answers: Record<string, unknown[]> = { upcoming: [], past: [] }
const calls: unknown[][] = []
jest.mock("@/lib/token-bot", () => ({
  callTokenBot: async (...a: unknown[]) => {
    calls.push(a)
    const past = (a[2] as { past?: boolean } | undefined)?.past
    return { status: 200, body: { ok: true, bookings: past ? answers.past : answers.upcoming, policy: "Full refund up to 30 days before, 50% between 30 and 7 days before, no refund within 7 days." } }
  },
}))
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))

import { MyBookings } from "@/components/dashboard/my-bookings"

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })
const inv = (id: number, total: number, due: number) => ({ id, number: `2026_RCC_${id}`, total, communication: `+++000/000${id}/0000${id}+++`, pdfUrl: `https://odoo.test/my/invoices/${id}?access_token=t&report_type=pdf&download=true`, due })

test("upcoming: pass and room, paid or pending with Pay, Cancel for a room, the invoice PDF", async () => {
  answers.upcoming = [
    { kind: "cowork", label: "Coworking half day", date: today, invoice: inv(1, 12.71, 0), status: "paid" },
    { kind: "room", label: "Satoshi Room", start: "2030-01-08T08:00:00Z", end: "2030-01-08T10:00:00Z", guest: "Leo", invoice: inv(2, 101.64, 101.64), status: "pending", cancel: { refundPercent: 100, refund: 101.64 } },
  ]
  answers.past = []
  const html = renderToStaticMarkup((await MyBookings({ who: { testUser: { email: "t@x.org", partnerId: 1, name: "T" } }, paid: "2026_RCC_1" }))!)
  expect(html).toContain("Coworking half day pass")
  expect(html).toContain("Today")
  expect(html).toContain("Satoshi Room · for Leo")
  expect(html).toContain("Tue 8 Jan, 09:00–11:00")
  expect(html).toContain("Pending payment")
  expect(html).toContain("Pay €101.64")
  expect(html).toContain(">Cancel<")
  expect(html).toContain("2026_RCC_2 (PDF)")
  expect(html).toContain("https://odoo.test/my/invoices/2?access_token=t&amp;report_type=pdf&amp;download=true")
  expect(html).toContain("Paid, thank you: invoice 2026_RCC_1")
  expect(html).toContain("Upcoming")
  expect(html).toContain("Past")
  expect(calls.slice(-2)).toEqual([["mine", { testUser: { email: "t@x.org", partnerId: 1, name: "T" } }], ["mine", { testUser: { email: "t@x.org", partnerId: 1, name: "T" } }, { past: true }]])
})

test("never booked: nothing shown", async () => {
  answers.upcoming = []
  answers.past = []
  expect(await MyBookings({ who: "123" })).toBe(null)
})
