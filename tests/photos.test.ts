import { describe, expect, test } from "@jest/globals"
import { isPublicPhotoPath, photoSource } from "@/lib/photos"

const url = "https://cdn.discordapp.com/attachments/1/2/x.jpg?ex=1&is=2&hm=3&"

describe("photoSource", () => {
  test("the public copy when chb made one", () => {
    expect(photoSource({ url, filePath: "2026/09/public/images/1551522479292555345.jpeg" })).toBe("/data/2026/09/public/images/1551522479292555345.jpeg")
    expect(photoSource({ url, filePath: "/data/2026/09/public/images/1.png" })).toBe("/data/2026/09/public/images/1.png")
  })

  test("the Discord link otherwise: no copy, or a copy that is not public", () => {
    expect(photoSource({ url })).toBe(url)
    expect(photoSource({ url, filePath: "2026/09/providers/discord/images/1.jpg" })).toBe(url)
    expect(photoSource({ url, filePath: "2026/09/members/images/1.jpg" })).toBe(url)
    expect(photoSource({ url, filePath: "2026/09/public/images/../../stewards/x.jpg" })).toBe(url)
  })

  test("public photo paths are recognised for immutable caching", () => {
    expect(isPublicPhotoPath("2026/09/public/images/1.jpg")).toBe(true)
    expect(isPublicPhotoPath("2026/09/public/events/images/evt.png")).toBe(false)
  })
})
