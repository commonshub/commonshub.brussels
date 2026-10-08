import { createHmac, timingSafeEqual } from "crypto"

/**
 * The community tablet in the hub is trusted with members-only data (booking
 * titles, introductions), but /tablet is a public address. So trust belongs
 * to the device: a steward pairs it from their phone (lib/tablet-pairing),
 * which leaves a signed cookie for a year. Nobody signs in on the tablet.
 * Without the cookie, /tablet shows what anyone may see.
 *
 * The cookie is `<issued>.<steward id>.<signature>`, signed with the site's
 * auth secret: it cannot be made up, and rotating that secret revokes every
 * trusted device. It is renewed whenever the tablet loads /tablet (at most
 * once a day, /api/tablet/renew), so a tablet in use stays paired for good:
 * restarting the app or the tablet keeps it, only clearing the browser's data
 * (or a year unused) needs a new pairing. Neither an IP address (anyone on
 * the hub's wifi would share it) nor a browser fingerprint (it changes with
 * updates, and can be copied) would be safer than this cookie.
 */

export const TRUST_COOKIE = "chb_tablet"
export const TRUST_MAX_AGE = 365 * 86_400

const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""
const sign = (payload: string) => createHmac("sha256", secret()).update(`tablet:${payload}`).digest("base64url")

/** The cookie value trusting this device, issued by a steward. */
export function trustToken(stewardId: string, now = Date.now()): string {
  const payload = `${Math.floor(now / 1000)}.${stewardId.replace(/[^\w-]/g, "")}`
  return `${payload}.${sign(payload)}`
}

/** Is this cookie value a valid trust, less than a year old? */
export function isTrusted(token: string | undefined | null, now = Date.now()): boolean {
  if (!token || !secret()) return false
  const parts = token.split(".")
  if (parts.length !== 3) return false
  const [issued, steward, signature] = parts
  const expected = Buffer.from(sign(`${issued}.${steward}`))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  const age = now / 1000 - Number(issued)
  return age >= 0 && age < TRUST_MAX_AGE
}

/** The trust cookie's value in a request. */
export function trustCookieOf(request: Request): string | undefined {
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${TRUST_COOKIE}=([^;]+)`))?.[1]
}

/** A fresh cookie value for a valid trust older than a day (same steward), or null: keeps a tablet in use paired. */
export function renewedToken(token: string | undefined | null, now = Date.now()): string | null {
  if (!token || !isTrusted(token, now)) return null
  const [issued, steward] = token.split(".")
  if (now / 1000 - Number(issued) < 86_400) return null
  return trustToken(steward, now)
}
