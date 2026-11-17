import { renderToStaticMarkup } from "react-dom/server"

const answer = { status: 200, body: { ok: true, bookings: [] as unknown[] } }
const calls: unknown[][] = []
jest.mock("@/lib/token-bot", () => ({ callTokenBot: async (...a: unknown[]) => (calls.push(a), answer) }))

import { MyBookings } from "@/components/dashboard/my-bookings"

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })

test("passes and rooms, paid or pending with a link to pay by transfer", async () => {
  answer.body.bookings = [
    { kind: "cowork", label: "Coworking half day", date: today, invoice: { id: 1, number: "2026_RCC_1", total: 12.71, communication: "+++000/0001/00001+++" }, status: "paid" },
    { kind: "room", label: "Satoshi Room", start: "2030-01-08T08:00:00Z", end: "2030-01-08T10:00:00Z", guest: "Leo", invoice: { id: 2, number: "2026_RCC_2", total: 101.64, communication: "+++000/0002/00002+++" }, status: "pending" },
  ]
  const html = renderToStaticMarkup(await MyBookings({ who: { testUser: { email: "t@x.org", partnerId: 1, name: "T" } }, paid: "2026_RCC_1" }))
  expect(html).toContain("Coworking half day pass")
  expect(html).toContain("Today")
  expect(html).toContain("Paid")
  expect(html).toContain("Satoshi Room · for Leo")
  expect(html).toContain("Tue 8 Jan, 09:00–11:00")
  expect(html).toContain("Pending payment")
  expect(html).toContain('href="/pay?amount=101.64&amp;communication=%2B%2B%2B000%2F0002%2F00002%2B%2B%2B"')
  expect(html).toContain("Paid, thank you: invoice 2026_RCC_1")
  expect(calls[0]).toEqual(["mine", { testUser: { email: "t@x.org", partnerId: 1, name: "T" } }])
})

test("nothing booked: nothing shown", async () => {
  answer.body.bookings = []
  expect(await MyBookings({ who: "123" })).toBe(null)
})
