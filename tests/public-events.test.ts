import { describe, expect, test } from "@jest/globals"
import { isPublicEventUrl, unwrapGoogleRedirect } from "@/lib/public-events"

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
    expect(isPublicEventUrl("https://www.lesateliersdumidi.be/")).toBe(true)
  })
})
