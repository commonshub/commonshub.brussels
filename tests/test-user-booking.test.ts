/**
 * A test user (signed in with an email code, in the bot's TEST_LOGIN_EMAILS) books through the bot
 * as a test user and pays with Stripe's sandbox key, never the live one.
 */
const session: { user: Record<string, unknown> } = { user: {} }
jest.mock("@/auth", () => ({ auth: async () => session }))
jest.mock("@/lib/admin-check", () => ({ isMember: async () => false }))
const stripeKeys: string[] = []
jest.mock("stripe", () =>
  jest.fn().mockImplementation((key: string) => {
    stripeKeys.push(key)
    return { checkout: { sessions: { create: async () => ({ url: "https://checkout.stripe.test/x" }) } } }
  }),
)

import { POST } from "@/app/api/hub/[action]/route"
import { pickFields } from "@/lib/token-bot"

const INVOICE = { id: 1, number: "2026_RCC_T1", untaxed: 42, vat: 8.82, total: 50.82, communication: "+++000/0070/00011+++", due: null, partnerName: "Test user", sentTo: "t@example.org", emailed: true }
let sent: Record<string, unknown>[] = []

beforeEach(() => {
  sent = []
  stripeKeys.length = 0
  process.env.TOKEN_BOT_URL = "https://bot.test"
  process.env.TOKEN_BOT_API_TOKEN = "tok"
  process.env.STRIPE_SECRET_KEY = "sk_live_x"
  process.env.STRIPE_TEST_SECRET_KEY = "sk_test_x"
  global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ ok: true, test: true, room: { name: "Satoshi Room" }, invoice: INVOICE }), { status: 200 })
  }) as never
})

const call = (action: string, body: Record<string, unknown>) =>
  POST(new Request(`https://commonshub.brussels/api/hub/${action}`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ action }) })

test("a test user goes to the bot as testUser and pays with the sandbox key", async () => {
  session.user = { authMethod: "email", testMode: true, email: "xdamman+test@gmail.com", odooPartnerId: 9000, username: "Test user" }
  const res = await call("paybook", { requestId: "req-1", room: "satoshi", start: "x", end: "y", org: "self", pay: "card", userId: "123", testUser: { email: "evil@example.org" } })
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ checkoutUrl: "https://checkout.stripe.test/x" })
  expect(sent[0]).toMatchObject({ testUser: { email: "xdamman+test@gmail.com", partnerId: 9000, name: "Test user" } })
  expect(sent[0].userId).toBeUndefined()
  expect(stripeKeys).toEqual(["sk_test_x"])
})

test("without the sandbox key, a test user is never charged with the live one", async () => {
  session.user = { authMethod: "email", testMode: true, email: "xdamman+test@gmail.com", odooPartnerId: 9000 }
  delete process.env.STRIPE_TEST_SECRET_KEY
  const body = await (await call("paybook", { requestId: "req-2", org: "self", pay: "card" })).json()
  expect(body.checkoutError).toBeTruthy()
  expect(stripeKeys).toEqual([])
})

test("an email user (an Odoo contact) books as emailUser, with the live Stripe key; a non-member on Discord can't", async () => {
  session.user = { discordId: "123" }
  expect((await call("options", {})).status).toBe(403)
  expect(sent).toEqual([])
  session.user = { authMethod: "email", email: "someone@example.org", odooPartnerId: 5 }
  global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ ok: true, invoice: INVOICE }), { status: 200 })
  }) as never
  expect((await call("paybook", { org: "self", pay: "card", emailUser: { email: "other@example.org" } })).status).toBe(200)
  expect(sent[0]).toMatchObject({ emailUser: { email: "someone@example.org" } })
  expect(sent[0].userId).toBeUndefined()
  expect(stripeKeys).not.toContain("sk_test_x")
})

test("the browser can't pass a test identity along", () => {
  expect(pickFields("paybook", { testUser: { email: "x" }, org: "self" })).toEqual({ org: "self" })
})

test("pay what's left on an invoice by card: the amount comes from the bot, sandbox for a test user", async () => {
  session.user = { authMethod: "email", testMode: true, email: "xdamman+test@gmail.com", odooPartnerId: 9000 }
  global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)))
    return new Response(JSON.stringify({ ok: true, bookings: [{ kind: "room", label: "Satoshi Room", invoice: { ...INVOICE, id: 7, due: 25.41 } }] }), { status: 200 })
  }) as never
  const r = await call("payinvoice", { invoiceId: "7", amount: "0.01" })
  expect(await r.json()).toMatchObject({ ok: true, checkoutUrl: "https://checkout.stripe.test/x" })
  expect(stripeKeys).toEqual(["sk_test_x"])
  expect((await call("payinvoice", { invoiceId: "8" })).status).toBe(404)
})
