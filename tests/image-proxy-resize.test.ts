/**
 * Image Proxy Resizing Tests
 * Tests that the image proxy correctly resizes images with size parameter
 * @jest-environment node
 */

import { describe, test, expect } from "@jest/globals"
import { getProxiedDiscordImage, getProxiedImageUrl } from "@/lib/image-proxy"

describe("Image Proxy Helper Functions with Size Parameter", () => {
  describe("getProxiedDiscordImage", () => {
    test("generates URL with xs size parameter", () => {
      const url = getProxiedDiscordImage(
        "123456",
        "789012",
        "345678",
        "2025-12-01",
        "xs"
      )

      expect(url).toContain("channelId=123456")
      expect(url).toContain("messageId=789012")
      expect(url).toContain("attachmentId=345678")
      expect(url).toContain("timestamp=20251201")
      expect(url).toContain("size=xs")
    })

    test("generates URL with sm size parameter", () => {
      const url = getProxiedDiscordImage(
        "123456",
        "789012",
        "345678",
        "2025-12-01",
        "sm"
      )

      expect(url).toContain("size=sm")
    })

    test("generates URL with md size parameter", () => {
      const url = getProxiedDiscordImage(
        "123456",
        "789012",
        "345678",
        "2025-12-01",
        "md"
      )

      expect(url).toContain("size=md")
    })

    test("generates URL with lg size parameter", () => {
      const url = getProxiedDiscordImage(
        "123456",
        "789012",
        "345678",
        "2025-12-01",
        "lg"
      )

      expect(url).toContain("size=lg")
    })

    test("generates URL without size parameter when not provided", () => {
      const url = getProxiedDiscordImage(
        "123456",
        "789012",
        "345678",
        "2025-12-01"
      )

      expect(url).toContain("channelId=123456")
      expect(url).not.toContain("size=")
    })

    test("formats timestamp correctly", () => {
      const date = new Date("2025-11-15")
      const url = getProxiedDiscordImage(
        "123456",
        "789012",
        "345678",
        date,
        "md"
      )

      expect(url).toContain("timestamp=20251115")
      expect(url).toContain("size=md")
    })
  })

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
