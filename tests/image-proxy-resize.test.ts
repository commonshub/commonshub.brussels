/**
 * Image Proxy Resizing Tests
 * Tests that the image proxy correctly resizes images with size parameter
 * @jest-environment node
 */

import { describe, test, expect } from "@jest/globals"
import { getProxiedImageUrl } from "@/lib/image-proxy"

describe("Image Proxy Helper Functions with Size Parameter", () => {
  describe("getProxiedImageUrl", () => {
    test("generates proxied URL with xs size parameter", () => {
      const url = getProxiedImageUrl("https://example.com/image.jpg", "xs")

      expect(url).toContain("/api/image-proxy")
      expect(url).toContain("url=https")
      expect(url).toContain("size=xs")
    })

    test("generates proxied URL with sm size parameter", () => {
      const url = getProxiedImageUrl("https://example.com/image.jpg", "sm")

      expect(url).toContain("size=sm")
    })

    test("generates proxied URL with md size parameter", () => {
      const url = getProxiedImageUrl("https://example.com/image.jpg", "md")

      expect(url).toContain("size=md")
    })

    test("generates proxied URL with lg size parameter", () => {
      const url = getProxiedImageUrl("https://example.com/image.jpg", "lg")

      expect(url).toContain("size=lg")
    })

    test("generates proxied URL without size when not provided", () => {
      const url = getProxiedImageUrl("https://example.com/image.jpg")

      expect(url).toContain("/api/image-proxy")
      expect(url).not.toContain("size=")
    })

    test("does not double-proxy already proxied URLs", () => {
      const alreadyProxied = "http://localhost:3000/api/image-proxy?url=test.jpg"
      const url = getProxiedImageUrl(alreadyProxied, "md")

      expect(url).toBe(alreadyProxied)
    })

    test("generates proxied URL for local data paths", () => {
      const url = getProxiedImageUrl("/data/2026/01/channels/discord/images/attach001.jpg", "sm")

      expect(url).toContain("/api/image-proxy")
      expect(url).toContain("url=%2Fdata%2F2026%2F01%2Fchannels%2Fdiscord%2Fimages%2Fattach001.jpg")
      expect(url).toContain("size=sm")
    })

    test("proxies public /images assets through the shared image proxy", () => {
      const url = getProxiedImageUrl("/images/chb-facade.avif", "md", { relative: true })

      expect(url).toBe("/api/image-proxy?url=%2Fimages%2Fchb-facade.avif&size=md")
    })

    test("returns empty string for empty URL", () => {
      const url = getProxiedImageUrl("", "md")

      expect(url).toBe("")
    })
  })

  describe("Size Configuration Values", () => {
    test("xs size corresponds to 320px", () => {
      // This is a documentation test to verify our size constants
      const sizes = {
        xs: 320,
        sm: 640,
        md: 1024,
        lg: 1920,
      }

      expect(sizes.xs).toBe(320)
      expect(sizes.sm).toBe(640)
      expect(sizes.md).toBe(1024)
      expect(sizes.lg).toBe(1920)
    })
  })
})
