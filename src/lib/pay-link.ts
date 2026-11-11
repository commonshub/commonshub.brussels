/**
 * /pay?amount=100.50&communication=…: a bank transfer filled in from the
 * link, to send with an invoice. Everything in the link is the public's to
 * type, so it is read strictly: an amount in euros and cents, a
 * communication that is either a Belgian structured one (checked) or a
 * short line of plain text.
 */

/** "100.50", "100,5", "100": euros, at most two decimals, under a million. Anything else: no amount (the payer fills it in). */
export function parseAmount(raw: string | null | undefined): number | null {
  const m = raw?.trim().match(/^(\d{1,6})(?:[.,](\d{1,2}))?$/)
  if (!m) return null
  const amount = Number(`${m[1]}.${(m[2] ?? "").padEnd(2, "0")}`)
  return amount > 0 ? amount : null
}

/**
 * A Belgian structured communication, as "+++123/4567/89012+++", or null.
 * Accepts it with or without the plus signs (a "+" in a link arrives as a
 * space), stars or slashes, or as 12 bare digits; the last two digits must
 * be the first ten modulo 97 (97 when that is 0).
 */
export function structuredCommunication(raw: string | null | undefined): string | null {
  const m = raw?.trim().match(/^[+*\s]{0,6}(\d{3})\s?\/?\s?(\d{4})\s?\/?\s?(\d{5})[+*\s]{0,6}$/)
  if (!m) return null
  const digits = m[1] + m[2] + m[3]
  const check = Number(digits.slice(0, 10)) % 97 || 97
  return check === Number(digits.slice(10)) ? `+++${m[1]}/${m[2]}/${m[3]}+++` : null
}

/** Free text for the transfer's message: one line of the characters banks accept (SEPA's Latin set), at most 140. */
export function freeCommunication(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9/\-?:().,'+ _]/g, "")
    .replace(/ +/g, " ")
    .trim()
    .slice(0, 140)
}

export interface PayRequest {
  amount: number | null
  /** "+++123/4567/89012+++", when the communication is a structured one. */
  structured: string | null
  /** Otherwise the message, possibly empty. */
  message: string
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** `communication`, or its synonym `description`. */
export function parsePayRequest(params: Record<string, string | string[] | undefined>): PayRequest {
  const communication = (first(params.communication) ?? first(params.description) ?? "").slice(0, 300)
  const structured = structuredCommunication(communication)
  return { amount: parseAmount(first(params.amount)), structured, message: structured ? "" : freeCommunication(communication) }
}
