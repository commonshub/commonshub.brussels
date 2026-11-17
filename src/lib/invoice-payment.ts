/**
 * Paying an invoice the bot made for a booking paid in euros: now by card
 * (Stripe Checkout, created here server-side from the bot's answer, so the
 * amount is the invoice's and never the browser's), or later by bank
 * transfer on /pay with the invoice's structured communication.
 *
 * The invoice number goes on the Stripe payment (description, metadata,
 * client_reference_id): chb's hourly Stripe sync books the charge in Odoo
 * and reconciles it with the invoice by that number.
 */

export interface BotInvoice {
  id: number
  number: string
  untaxed: number
  vat: number
  total: number
  communication: string
  due: string | null
  partnerName: string
  sentTo: string | null
  emailed: boolean
}

/** /pay with the amount and the communication that matches the transfer to the invoice. */
export function payLaterUrl(invoice: Pick<BotInvoice, "total" | "communication">): string {
  return `/pay?amount=${invoice.total.toFixed(2)}&communication=${encodeURIComponent(invoice.communication)}`
}

/** Stripe Checkout parameters for paying this invoice in full. */
export function checkoutParams(invoice: BotInvoice, what: string, origin: string) {
  const label = `Invoice ${invoice.number}: ${what}`.slice(0, 250)
  // client_reference_id allows letters, digits, - and _ only.
  const reference = invoice.number.replace(/[^\w-]/g, "-").slice(0, 200)
  return {
    mode: "payment" as const,
    client_reference_id: reference,
    ...(invoice.sentTo ? { customer_email: invoice.sentTo } : {}),
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: Math.round(invoice.total * 100), product_data: { name: label } } }],
    payment_intent_data: { description: label, metadata: { invoice: invoice.number, odooInvoiceId: String(invoice.id), kind: "booking" } },
    metadata: { invoice: invoice.number, odooInvoiceId: String(invoice.id), kind: "booking" },
    success_url: `${origin}/booking/paid?invoice=${encodeURIComponent(invoice.number)}`,
    // Changed their mind: the invoice is still there, payable by transfer.
    cancel_url: `${origin}${payLaterUrl(invoice)}`,
  }
}
