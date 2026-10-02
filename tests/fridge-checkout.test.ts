/**
 * @jest-environment node
 *
 * The fridge checkout describes the order from the current delivery, never
 * from what the browser sends, and refuses drinks that are not in it.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals"

const create = jest.fn(async (_params: Record<string, unknown>) => ({ url: "https://checkout.stripe.test/s" }))
jest.mock("stripe", () => jest.fn().mockImplementation(() => ({ checkout: { sessions: { create } } })))

const drink = (id: string, name: string, crateCost: number) => ({ id, name, size: "33cl", perCrate: 24, bottles: 24, costPerBottle: crateCost / 24, crateCost, suggested: 1.5 })
jest.mock("@/lib/fridge", () => ({
  ...(jest.requireActual("@/lib/fridge") as object),
  loadLatestDelivery: () => ({ number: "CHB-S/2026/09/0013", date: "2026-09-30", drinks: [drink("2133", "Zinnebir 5,8%", 34.8), drink("4794", "Fritz Limo Citron", 32.16)] }),
}))

process.env.STRIPE_SECRET_KEY = "sk_test_x"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require("@/app/api/fridge/checkout/route") as typeof import("@/app/api/fridge/checkout/route")

const post = (body: object) => POST(new Request("https://commonshub.brussels/api/fridge/checkout", { method: "POST", body: JSON.stringify(body) }))

beforeEach(() => create.mockClear())

describe("fridge checkout", () => {
  test("drinks: one payment described from the delivery", async () => {
    const res = await post({ items: [{ id: "2133", quantity: 2 }, { id: "4794", quantity: 1 }, { id: "nope", quantity: 3 }], amount: 4.5 })
    expect(res.status).toBe(200)
    const params = create.mock.calls[0][0] as any
    expect(params.mode).toBe("payment")
    expect(params.line_items[0].price_data.unit_amount).toBe(450)
    expect(params.payment_intent_data.description).toBe("Fridge: 2× Zinnebir 5,8%, 1× Fritz Limo Citron")
    expect(params.metadata).toEqual({ kind: "fridge", delivery: "CHB-S/2026/09/0013" })
  })

  test("a crate", async () => {
    await post({ crate: "2133", amount: 35 })
    expect((create.mock.calls[0][0] as any).payment_intent_data.description).toBe("Fridge: a crate of Zinnebir 5,8% for the community")
  })

  test("nothing known, unknown crate or a silly amount: refused before Stripe", async () => {
    expect((await post({ items: [{ id: "nope", quantity: 1 }], amount: 2 })).status).toBe(400)
    expect((await post({ crate: "nope", amount: 30 })).status).toBe(400)
    expect((await post({ items: [{ id: "2133", quantity: 1 }], amount: 0.2 })).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })
})
