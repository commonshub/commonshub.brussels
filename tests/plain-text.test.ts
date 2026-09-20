import { describe, expect, test } from "@jest/globals"
import { htmlToPlainText, looksLikeHtml } from "@/lib/plain-text"

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
