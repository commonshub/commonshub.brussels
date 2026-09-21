/**
 * Which calendar entries are public events.
 *
 * The room calendars hold everything that happens in the space, including
 * private bookings. An entry is a public event only when it links to an
 * event page somewhere: no link, or a link into someone's mailbox, drive or
 * calendar, means it is a booking note for the stewards, not an invitation.
 */

/** Hosts that are private tools or plain locations, never an event page. */
const PRIVATE_HOSTS = [
  "collective.email",
  "maps.google.com",
  "maps.app.goo.gl",
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
    const { hostname, protocol, pathname, search } = new URL(target)
    if (protocol !== "http:" && protocol !== "https:") return false
    if (PRIVATE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return false
    // A map pin is where something is, not what it is.
    if (hostname.endsWith("google.com") && pathname.startsWith("/maps")) return false
    // An organisation's homepage is who is coming, not an event page.
    if ((pathname === "" || pathname === "/") && !search) return false
    return true
  } catch {
    return false
  }
}

/** "Brusano Booking", "Bevestigd: …", "Réservation …": the calendar's own word for a private booking. */
const BOOKING_TITLE = /\b(booking|bevestigd|bevestiging|confirmed|confirmation|r[ée]serv(ation|é|ed)?)\b/i

/** A calendar entry worth listing publicly: an event page, and not filed as a booking. */
export function isPublicEvent(event: { name?: string; title?: string; url?: string | null }): boolean {
  const name = event.name ?? event.title ?? ""
  if (BOOKING_TITLE.test(name)) return false
  return isPublicEventUrl(event.url)
}
