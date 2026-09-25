/**
 * @jest-environment node
 *
 * What the checkout asks Stripe for: a one-off payment by default, a
 * monthly subscription only when asked and only for a recurring cost.
 */
import { describe, expect, jest, test, beforeEach } from "@jest/globals"

const create = jest.fn(async (_params: Record<string, unknown>) => ({ url: "https://checkout.stripe.test/s" }))
jest.mock("stripe", () => jest.fn().mockImplementation(() => ({ checkout: { sessions: { create } } })))

const EXPENSES = {
  recurring: [{ slug: "acoustic-booth-wenap", kind: "recurring", label: "Furniture rental: phone booth (WeNap)", reference: "acoustic-booth-wenap", message: "Contribution phone booth", amountEur: 133.1 }],
  oneTime: [{ slug: "bill-1", kind: "one-time", label: "Dishwasher", reference: "BILL/2026/0042", message: "Contribution BILL/2026/0042", amountEur: 400 }],
}
jest.mock("@/lib/contribute-expenses", () => ({
  loadContributeExpenses: () => EXPENSES,
  findExpense: (slug: string, e: typeof EXPENSES) => [...e.recurring, ...e.oneTime].find((x) => x.slug === slug),
}))

process.env.STRIPE_SECRET_KEY = "sk_test_x"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require("@/app/api/contribute/checkout/route") as typeof import("@/app/api/contribute/checkout/route")

const post = (body: object) =>
  POST(new Request("https://commonshub.brussels/api/contribute/checkout", { method: "POST", body: JSON.stringify(body) }))

beforeEach(() => {
  create.mockClear()
})

describe("contribution checkout", () => {
  test("once: a payment, tagged with the short message", async () => {
    const res = await post({ slug: "acoustic-booth-wenap", amount: 60 })
    expect(res.status).toBe(200)
    const params = create.mock.calls[0][0] as any
    expect(params.mode).toBe("payment")
    expect(params.line_items[0].price_data.unit_amount).toBe(6000)
    expect(params.line_items[0].price_data.recurring).toBeUndefined()
    expect(params.payment_intent_data.description).toBe("Contribution phone booth")
  })

  test("monthly: a subscription of the same amount every month", async () => {
    await post({ slug: "acoustic-booth-wenap", amount: 60, monthly: true })
    const params = create.mock.calls[0][0] as any
    expect(params.mode).toBe("subscription")
    expect(params.line_items[0].price_data).toMatchObject({ unit_amount: 6000, recurring: { interval: "month" } })
    expect(params.subscription_data).toMatchObject({ description: "Contribution phone booth", metadata: { expense: "acoustic-booth-wenap", monthly: "yes" } })
    expect(params.success_url).toContain("thanks=monthly")
  })

  test("a one-time bill is never turned into a subscription", async () => {
    await post({ slug: "bill-1", amount: 100, monthly: true })
    expect((create.mock.calls[0][0] as any).mode).toBe("payment")
  })

  test("amounts outside the bounds are refused before Stripe is called", async () => {
    const res = await post({ slug: "acoustic-booth-wenap", amount: 5, monthly: true })
    expect(res.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })
})
