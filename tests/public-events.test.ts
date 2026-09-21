import { describe, expect, test } from "@jest/globals"
import { isPublicEvent, isPublicEventUrl, unwrapGoogleRedirect } from "@/lib/public-events"

describe("public events", () => {
  test("an entry without a link is a booking, not an event", () => {
    expect(isPublicEventUrl("")).toBe(false)
    expect(isPublicEventUrl(undefined)).toBe(false)
    expect(isPublicEventUrl("not a url")).toBe(false)
  })

  test("a link into a mailbox does not count, even wrapped by Google Calendar", () => {
    const wrapped =
      "https://www.google.com/url?q=https://mail.google.com/mail/u/0/?tab%3Drm%26ogbl%23all/FMfcgzQ&amp;sa=D&amp;source=calendar"
    expect(unwrapGoogleRedirect(wrapped)).toBe("https://mail.google.com/mail/u/0/?tab=rm&ogbl#all/FMfcgzQ")
    expect(isPublicEventUrl(wrapped)).toBe(false)
    expect(isPublicEventUrl("https://docs.google.com/document/d/abc")).toBe(false)
  })

  test("an event page counts", () => {
    expect(isPublicEventUrl("https://luma.com/xh70cr0g")).toBe(true)
    expect(isPublicEventUrl("https://www.google.com/url?q=https://luma.com/abc&sa=D")).toBe(true)
    expect(isPublicEventUrl("https://discord.com/channels/1280532848604086365/1354/1")).toBe(true)
    expect(isPublicEventUrl("https://example.org/events/open-day")).toBe(true)
  })

  test("a homepage, a map pin or a mail tool is not an event page", () => {
    expect(isPublicEventUrl("https://www.lesateliersdumidi.be/")).toBe(false)
    expect(isPublicEventUrl("http://www.steward-owned.be")).toBe(false)
    expect(isPublicEventUrl("https://www.google.com/maps/search/Rue+Ville+Basse")).toBe(false)
    expect(isPublicEventUrl("https://collective.email/inbox/commonshub/thread/64")).toBe(false)
  })

  test("an entry the calendar itself calls a booking stays private", () => {
    expect(isPublicEvent({ name: "Brusano Booking", url: "https://luma.com/abc" })).toBe(false)
    expect(isPublicEvent({ name: "Bevestigd: Vlaams Instituut - meeting", url: "https://luma.com/abc" })).toBe(false)
    expect(isPublicEvent({ name: "Open Community Potluck Lunch", url: "https://luma.com/abc" })).toBe(true)
  })
})
