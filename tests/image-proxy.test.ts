/**
 * Image Proxy API Route Tests
 * Tests external URL proxying functionality
 *
 * Note: For Discord image serving tests, see discord-image-proxy.test.ts
 *
 * @jest-environment node
 */

import { describe, test, expect, jest, beforeEach } from "@jest/globals"

// Mock fetch for external URL tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

// Mock sharp for image resizing
const mockSharp = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("resized-image-data")),
}
jest.mock("sharp", () => jest.fn(() => mockSharp))

// Now import the route after mocks are set up
import { NextRequest } from "next/server"
import { GET } from "@/app/api/image-proxy/route"

describe("Image Proxy API Route", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Request Validation", () => {
    test("returns 400 when url parameter is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/image-proxy")

      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Missing required parameter: url")
    })

    test("returns 400 when url parameter is empty", async () => {
      const request = new NextRequest("http://localhost:3000/api/image-proxy?url=")

      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Missing required parameter: url")
    })

    test("returns 400 for recursive proxy attempts", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=http://localhost:3000/api/image-proxy?url=https://example.com/image.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Cannot proxy a proxy URL")
    })
  })

  describe("External URL Proxying", () => {
    test("proxies allowed external Discord CDN URLs", async () => {
      const mockImageData = new ArrayBuffer(100)
      const mockResponse = {
        ok: true,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: jest.fn().mockResolvedValue(mockImageData),
      }
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as any
      )

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=https://cdn.discordapp.com/attachments/123/456/image.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(global.fetch).toHaveBeenCalledWith(
        "https://cdn.discordapp.com/attachments/123/456/image.jpg",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("CommonsHubBot"),
          }),
        })
      )
    })

    test("proxies Luma event cover images", async () => {
      const mockImageData = new ArrayBuffer(100)
      const mockResponse = {
        ok: true,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: jest.fn().mockResolvedValue(mockImageData),
      }
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as any
      )

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=https://images.lumacdn.com/event-covers/abc123.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(global.fetch).toHaveBeenCalled()
    })

    test("returns 403 for disallowed external domains", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=https://malicious-site.com/image.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Domain not allowed")
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test("handles external URL fetch failure", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      }
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as any
      )

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=https://cdn.discordapp.com/attachments/123/456/missing.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe("Failed to fetch image")
    })

    test("handles network errors gracefully", async () => {
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
        new Error("Network error")
      )

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=https://cdn.discordapp.com/attachments/123/456/image.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe("Failed to proxy image")
    })
  })

  describe("Cache and CORS Headers", () => {
    test("sets appropriate cache headers for external images", async () => {
      const mockImageData = new ArrayBuffer(100)
      const mockResponse = {
        ok: true,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: jest.fn().mockResolvedValue(mockImageData),
      }
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as any
      )

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=https://cdn.discordapp.com/attachments/123/456/image.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toContain("public")
      expect(response.headers.get("Cache-Control")).toContain("max-age")
    })

    test("sets CORS headers for all responses", async () => {
      const mockImageData = new ArrayBuffer(100)
      const mockResponse = {
        ok: true,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: jest.fn().mockResolvedValue(mockImageData),
      }
      ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
        mockResponse as any
      )

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=https://cdn.discordapp.com/attachments/123/456/image.jpg"
      )

      const response = await GET(request)

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    })
  })
})
