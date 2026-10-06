/**
 * Belgian structured communication ("+++123/4567/89012+++", OGM-VCS): ten
 * digits and a two-digit check (the number modulo 97, 97 when it is 0).
 *
 * For memberships we use Odoo's customer-based variant: the ten digits are
 * the member's Odoo partner id, so every transfer with that communication
 * belongs to that member and reconciles with their open membership invoice
 * (Odoo journal setting: communication standard "Belgian", type "Based on
 * customer").
 */

export function structuredCommunication(tenDigits: string): string {
  if (!/^\d{10}$/.test(tenDigits)) throw new Error("A structured communication needs 10 digits")
  const check = (Number(tenDigits) % 97) || 97
  return `+++${tenDigits.slice(0, 3)}/${tenDigits.slice(3, 7)}/${tenDigits.slice(7)}${String(check).padStart(2, "0")}+++`
}

/** The communication Odoo puts on a member's invoices when the reference is based on the customer. */
export function partnerCommunication(odooPartnerId: number): string {
  return structuredCommunication(String(odooPartnerId).padStart(10, "0"))
}

export function isValidStructuredCommunication(s: string): boolean {
  const digits = s.replace(/\D/g, "")
  if (digits.length !== 12) return false
  return ((Number(digits.slice(0, 10)) % 97) || 97) === Number(digits.slice(10))
}
