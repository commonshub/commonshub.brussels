/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals"
import { isProxyableImageUrl } from "@/lib/image-proxy-server"

describe("isProxyableImageUrl", () => {
  test("local dataset covers and allowed CDNs pass", () => {
    expect(isProxyableImageUrl("/data/2026/10/images/cover.jpg")).toBe(true)
    expect(isProxyableImageUrl("https://images.lumacdn.com/cdn-cgi/image/x.png")).toBe(true)
    expect(isProxyableImageUrl("https://cdn.discordapp.com/avatars/1/a.png")).toBe(true)
  })

  test("an og:image on an arbitrary host is refused, as the proxy would", () => {
    expect(isProxyableImageUrl("http://static1.squarespace.com/static/x/sf-brand-png.png?format=1500w")).toBe(false)
    expect(isProxyableImageUrl("https://evil-luma.com/x.png")).toBe(false)
  })

  test("garbage is refused", () => {
    expect(isProxyableImageUrl("")).toBe(false)
    expect(isProxyableImageUrl("https/www.innerpreneurs.org/logo")).toBe(false)
  })
})
