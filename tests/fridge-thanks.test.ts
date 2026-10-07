import { beforeEach, describe, expect, jest, test } from "@jest/globals"

import { attributionName, attributionOptions } from "@/lib/fridge-thanks"

const retrieve = jest.fn(async (_id: string): Promise<any> => session)
const update = jest.fn(async (_id: string, _params: any) => ({}))
jest.mock("stripe", () => jest.fn().mockImplementation(() => ({ checkout: { sessions: { retrieve } }, paymentIntents: { update } })))
const subscribe = jest.fn(async (_email: string) => true)
jest.mock("@/lib/paragraph", () => ({ subscribeToNewsletter: (email: string) => subscribe(email), isParagraphConfigured: () => true }))

let session: any
process.env.STRIPE_SECRET_KEY = "sk_test_x"
const SESSION = "cs_test_a1B2c3"

async function post(body: object) {
  const { POST } = await import("@/app/api/fridge/thanks/route")
  return POST(new Request("http://localhost/api/fridge/thanks", { method: "POST", body: JSON.stringify(body) }))
}

describe("thanking a fridge donor", () => {
  test("the choices show the names the payment came with, then Other", () => {
    expect(attributionOptions("Leen  Van Damme")).toEqual([
      { value: "anonymous", label: "Don't show my name" },
      { value: "first", label: "Leen" },
      { value: "full", label: "Leen Van Damme" },
      { value: "other", label: "Other…" },
    ])
    expect(attributionOptions(null).map((o) => o.value)).toEqual(["anonymous", "other"])
    expect(attributionOptions("Cher").map((o) => o.label)).toEqual(["Don't show my name", "Cher", "Other…"])
  })

  test("the name a choice shows; a name of one's own must be a plain name", () => {
    expect(attributionName("anonymous", "Leen Van Damme")).toBeNull()
    expect(attributionName("first", "Leen Van Damme")).toBe("Leen")
    expect(attributionName("full", "Leen Van Damme")).toBe("Leen Van Damme")
    expect(attributionName("other", "Leen Van Damme", " The Tuesday crew ")).toBe("The Tuesday crew")
    expect(attributionName("other", null, "see spam.com")).toBeUndefined()
    expect(attributionName("full", null)).toBeUndefined()
    expect(attributionName("everyone", "Leen")).toBeUndefined()
  })
})

describe("saving the choice after paying", () => {
  beforeEach(() => {
    retrieve.mockClear()
    update.mockClear()
    subscribe.mockClear()
    session = { id: SESSION, created: Math.floor(Date.now() / 1000) - 60, payment_status: "paid", metadata: { kind: "fridge" }, payment_intent: "pi_1", customer_details: { name: "Leen Van Damme" } }
  })

  test("kept on the payment, where the donor lists read it", async () => {
    const res = await post({ sessionId: SESSION, show: "first" })
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith("pi_1", { metadata: { thanks: "first", name: "Leen" } })
    expect(subscribe).not.toHaveBeenCalled()
  })

  test("not being named removes a name given before", async () => {
    await post({ sessionId: SESSION, show: "anonymous" })
    expect(update).toHaveBeenCalledWith("pi_1", { metadata: { thanks: "anonymous", name: "" } })
  })

  test("the newsletter: the address goes to Paragraph", async () => {
    const res = await post({ sessionId: SESSION, show: "anonymous", newsletter: true, email: " Leen@Example.org " })
    expect(await res.json()).toMatchObject({ ok: true, newsletter: "subscribed" })
    expect(subscribe).toHaveBeenCalledWith("leen@example.org")
  })

  test("refuses what is not a paid fridge donation of the past week, a bad name or email", async () => {
    expect((await post({ sessionId: "nope", show: "first" })).status).toBe(400)
    expect((await post({ sessionId: SESSION, show: "first", newsletter: true, email: "nope" })).status).toBe(400)
    expect((await post({ sessionId: SESSION, show: "other", other: "x" })).status).toBe(400)
    session.payment_status = "unpaid"
    expect((await post({ sessionId: SESSION, show: "first" })).status).toBe(404)
    session.payment_status = "paid"
    session.metadata = { kind: "membership" }
    expect((await post({ sessionId: SESSION, show: "first" })).status).toBe(404)
    session.metadata = { kind: "fridge" }
    session.created -= 8 * 86_400
    expect((await post({ sessionId: SESSION, show: "first" })).status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })
})
