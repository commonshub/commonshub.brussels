/**
 * Which calendar entries are public events.
 *
 * The room calendars hold everything that happens in the space, including
 * private bookings. An entry is a public event only when it links to an
 * event page somewhere: no link, or a link into someone's mailbox, drive or
 * calendar, means it is a booking note for the stewards, not an invitation.
 */

/** Hosts that are private tools, never an event page. */
const PRIVATE_HOSTS = [
  "mail.google.com",
  "calendar.google.com",
  "drive.google.com",
  "docs.google.com",
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "mail.proton.me",
  "mail.yahoo.com",
]

/**
 * Google Calendar wraps every link in a description as
 * https://www.google.com/url?q=<real url>&sa=D&…; the real address is what
 * matters, both for deciding and for linking.
 */
export function unwrapGoogleRedirect(url: string): string {
  try {
    const parsed = new URL(url.replace(/&amp;/g, "&"))
    if (parsed.hostname.endsWith("google.com") && parsed.pathname === "/url") {
      const target = parsed.searchParams.get("q")
      if (target) return target
    }
  } catch {
    // not a URL at all; handled by the caller
  }
  return url
}

export function isPublicEventUrl(url: string | undefined | null): boolean {
  if (!url) return false
  const target = unwrapGoogleRedirect(url)
  try {
    const { hostname, protocol } = new URL(target)
    if (protocol !== "http:" && protocol !== "https:") return false
    return !PRIVATE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}
