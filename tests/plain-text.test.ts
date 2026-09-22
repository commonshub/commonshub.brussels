import { describe, expect, test } from "@jest/globals"
import { htmlToPlainText, looksLikeHtml, redactContactDetails, shortenUrl, shortenUrls, tokensWording } from "@/lib/plain-text"

describe("htmlToPlainText", () => {
  test("a link whose text is its address becomes the bare address", () => {
    expect(
      htmlToPlainText('<a href="https://luma.com/brussels-satellite">https://luma.com/brussels-satellite</a>'),
    ).toBe("https://luma.com/brussels-satellite")
  })

  test("a link with its own text keeps the text and the address", () => {
    expect(htmlToPlainText('Sign up <a href="https://x.y/z">here</a>.')).toBe("Sign up here (https://x.y/z).")
  })

  test("blocks and breaks become line breaks, entities are decoded", () => {
    expect(htmlToPlainText("<p>Drinks &amp; talks</p><p>Doors 17:00<br>Talks 18:00</p>")).toBe(
      "Drinks & talks\nDoors 17:00\nTalks 18:00",
    )
  })

  test("list items get a bullet", () => {
    expect(htmlToPlainText("<ul><li>one</li><li>two</li></ul>")).toBe("• one\n• two")
  })

  test("plain text passes through untouched, even with a stray <", () => {
    const text = "Bring 2 < 3 friends\n\nFree drinks"
    expect(htmlToPlainText(text)).toBe(text)
    expect(looksLikeHtml(text)).toBe(false)
  })

  test("a link cut off before its closing tag still yields its address", () => {
    expect(htmlToPlainText('<a href="https://luma.com/brussels-satellite">https://luma.com/')).toBe(
      "https://luma.com/brussels-satellite",
    )
  })

  test("a tag cut off mid-attribute is dropped, keeping an address if it has one", () => {
    expect(htmlToPlainText('Paid booking via Ralph. Details to follow. <a href="lum')).toBe(
      "Paid booking via Ralph. Details to follow. lum",
    )
    expect(htmlToPlainText('<a href="https://www.speculativefutures.design/" target="_blank')).toBe(
      "https://www.speculativefutures.design/",
    )
    expect(htmlToPlainText("Doors open at 18:00 <a")).toBe("Doors open at 18:00")
  })

  test("empty stays empty", () => {
    expect(htmlToPlainText("")).toBe("")
  })
})

describe("redactContactDetails", () => {
  test("emails and phone numbers from a room booking never reach a public card", () => {
    expect(
      redactContactDetails("https://example.org/.\nTravis K\nTravisK@pm.me\n+32 470 12 34 56\n0470/12.34.56\n24 people max"),
    ).toBe("https://example.org/.\nTravis K\n24 people max")
  })

  test("ordinary text, times and prices are untouched", () => {
    const text = "Doors 18:00, talks 18:30. Tickets €12, 30 seats. Room 2 on floor 1."
    expect(redactContactDetails(text)).toBe(text)
  })
})

describe("shortening URLs for display", () => {
  test("a long URL is cut at a path boundary, not mid-token", () => {
    // The link that pushed the day page sideways on a phone.
    expect(shortenUrl("https://discord.com/channels/1280532848604086365/1354115945718878269/1551678021617066140")).toBe(
      "discord.com/channels/…"
    )
    expect(shortenUrl("https://images.lumacdn.com/uploads/dz/4cd6cf21-607f-48f7-b7f1-2f30c71e6fcd.png")).toBe(
      "images.lumacdn.com/uploads/…"
    )
    // Nothing left to cut: the host alone is already too long.
    expect(shortenUrl("https://a-very-long-hostname-that-never-ends.example.com/x", 20)).toBe("a-very-long-hostname-that-never-ends.example.com/…")
  })

  test("a short URL only loses its protocol", () => {
    expect(shortenUrl("https://luma.com/l9275g9x")).toBe("luma.com/l9275g9x")
    expect(shortenUrl("https://www.wikipolicy.net/")).toBe("wikipolicy.net")
  })

  test("URLs inside a description are shortened in place, punctuation kept out", () => {
    const text = "Booked by Dean on Monday.\nSee https://discord.com/channels/1280532848604086365/1354115945718878269/1551678021617066140 for details."
    expect(shortenUrls(text)).toBe("Booked by Dean on Monday.\nSee discord.com/channels/… for details.")
    expect(shortenUrls("Also (https://luma.com/hhfrzcha).")).toBe("Also (luma.com/hhfrzcha).")
    expect(shortenUrls("no links here")).toBe("no links here")
  })

  test("every shortened URL fits a phone-width card", () => {
    const urls = [
      "https://discord.com/channels/1280532848604086365/1354115945718878269/1551678021617066140",
      "https://www.google.com/maps/place/Rue+de+la+Madeleine+51,+1000+Bruxelles/@50.8455,4.3547,17z/data=!3m1!4b1",
      "https://luma.com/l9275g9x",
    ]
    for (const url of urls) expect(shortenUrl(url).length).toBeLessThanOrEqual(34)
  })
})

describe("our own wording for the token", () => {
  test("the booking bot's ticker becomes tokens", () => {
    expect(tokensWording("Booked by Dean on Monday for 1.50 CHT")).toBe("Booked by Dean on Monday for 1.50 tokens")
  })

  test("a word that merely contains those letters is left alone", () => {
    expect(tokensWording("CHTistoric CHT-ish archtype")).toBe("CHTistoric tokens-ish archtype")
    expect(tokensWording("nothing to change")).toBe("nothing to change")
  })
})
