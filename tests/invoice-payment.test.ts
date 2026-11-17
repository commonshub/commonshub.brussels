/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals"
import { checkoutParams, payLaterUrl, type BotInvoice } from "@/lib/invoice-payment"
import { ALLOWED_FIELDS, pickFields } from "@/lib/token-bot"

const invoice: BotInvoice = {
  id: 900,
  number: "2026_RCC_0105",
  untaxed: 42,
  vat: 8.82,
  total: 50.82,
  communication: "+++000/0090/00073+++",
  due: "2026-12-01",
  partnerName: "Acme SRL",
  sentTo: "billing@acme.example",
  emailed: true,
}

describe("paying a booking's invoice", () => {
  test("later: /pay with the amount and the structured communication", () => {
    expect(payLaterUrl(invoice)).toBe("/pay?amount=50.82&communication=%2B%2B%2B000%2F0090%2F00073%2B%2B%2B")
  })

  test("now: a Stripe Checkout for the invoice total, carrying the invoice number for chb's reconciliation", () => {
    const p = checkoutParams(invoice, "Satoshi Room", "https://commonshub.brussels")
    expect(p.line_items[0].price_data).toEqual({ currency: "eur", unit_amount: 5082, product_data: { name: "Invoice 2026_RCC_0105: Satoshi Room" } })
    expect(p.client_reference_id).toBe("2026_RCC_0105")
    expect(p.payment_intent_data.metadata).toEqual({ invoice: "2026_RCC_0105", odooInvoiceId: "900", kind: "booking" })
    expect(p.customer_email).toBe("billing@acme.example")
    expect(p.success_url).toBe("https://commonshub.brussels/booking/paid?invoice=2026_RCC_0105&session_id={CHECKOUT_SESSION_ID}")
    expect(p.cancel_url).toBe(`https://commonshub.brussels${payLaterUrl(invoice)}`)
    expect(checkoutParams({ ...invoice, number: "INV/2026/0001", sentTo: null }, "x", "https://o").client_reference_id).toBe("INV-2026-0001")
  })

  test("the browser can name an organisation and a payment method, never an amount", () => {
    expect(ALLOWED_FIELDS.paybook).toContain("org")
    expect(pickFields("paybook", { requestId: "r-12345678", room: "satoshi", org: "self", total: "1", amount: "1", pay: "card" })).toEqual({ requestId: "r-12345678", room: "satoshi", org: "self" })
    expect(pickFields("org", { name: "Acme", billing: "yes", billingcity: "Etterbeek", partnerId: "1" })).toEqual({ name: "Acme", billing: "yes", billingcity: "Etterbeek" })
  })
})
