/**
 * Image Proxy API Route Tests
 * Tests that the image proxy correctly serves local images and validates security
 * @jest-environment node
 */

import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals"

// Mock fs and path modules BEFORE importing the route
const mockExistsSync = jest.fn()
const mockReadFileSync = jest.fn()
const mockWriteFileSync = jest.fn()
const mockMkdirSync = jest.fn()

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  },
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
}))

// Mock sharp for image resizing
const mockSharp = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("resized-image-data")),
}
jest.mock("sharp", () => jest.fn(() => mockSharp))

// Mock fetch for external URL tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

// Mock discord module
jest.mock("@/lib/discord", () => ({
  discordGet: jest.fn(),
}))

// Now import the route after mocks are set up
import { NextRequest } from "next/server"
import { GET } from "@/app/api/image-proxy/route"
import { discordGet } from "@/lib/discord"

const mockDiscordGet = discordGet as jest.MockedFunction<typeof discordGet>

describe("Image Proxy API Route", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("Local Discord Image Serving", () => {
    test("serves local image with correct headers", async () => {
      const imageBuffer = Buffer.from("fake-image-data")
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/1234567890.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/jpeg")
      expect(response.headers.get("Cache-Control")).toContain("public")
      expect(response.headers.get("Cache-Control")).toContain("max-age=604800") // 7 days
      expect(mockExistsSync).toHaveBeenCalled()
      expect(mockReadFileSync).toHaveBeenCalled()
    })

    test("serves PNG images with correct content type", async () => {
      const imageBuffer = Buffer.from("fake-png-data")
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/1234567890.png"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/png")
    })

    test("serves WebP images with correct content type", async () => {
      const imageBuffer = Buffer.from("fake-webp-data")
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/1234567890.webp"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/webp")
    })

    test("returns 404 when local image file doesn't exist", async () => {
      mockExistsSync.mockReturnValue(false)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/nonexistent.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe("File not found")
      expect(mockReadFileSync).not.toHaveBeenCalled()
    })
  })

  describe("Security Validations", () => {
    test("rejects non-image file extensions", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/file.json"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Only image files are allowed")
      expect(mockExistsSync).not.toHaveBeenCalled()
    })

    test("rejects .txt files", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/file.txt"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Only image files are allowed")
    })

    test("rejects invalid path pattern (wrong directory)", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/other/images/1234567890.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Invalid path pattern")
    })

    test("rejects invalid path pattern (missing images directory)", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/1234567890.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Invalid path pattern")
    })

    test("rejects path with subdirectories in filename", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/../../secret.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Invalid path pattern")
    })

    test("validates year format (must be 4 digits)", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/25/11/discord/images/1234567890.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Invalid path pattern")
    })

    test("validates month format (must be 2 digits)", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/1/discord/images/1234567890.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Invalid path pattern")
    })
  })

  describe("Request Validation", () => {
    test("returns 400 when url parameter is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/image-proxy")

      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Missing required parameters")
    })

    test("returns 400 when url parameter is empty", async () => {
      const request = new NextRequest("http://localhost:3000/api/image-proxy?url=")

      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Missing required parameters")
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
  })

  describe("Cache Headers", () => {
    test("sets long cache duration for local images (7 days)", async () => {
      const imageBuffer = Buffer.from("fake-image-data")
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/1234567890.jpg"
      )

      const response = await GET(request)

      const cacheControl = response.headers.get("Cache-Control")
      expect(cacheControl).toContain("max-age=604800") // 7 days = 604800 seconds
      expect(cacheControl).toContain("s-maxage=604800")
      expect(cacheControl).toContain("public")
    })

    test("sets CORS headers for all responses", async () => {
      const imageBuffer = Buffer.from("fake-image-data")
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/1234567890.jpg"
      )

      const response = await GET(request)

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    })
  })

  describe("Real-world Path Examples", () => {
    test("handles typical November 2025 Discord image path", async () => {
      const imageBuffer = Buffer.from("fake-image-data")
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/1444784583106236426.jpg"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/jpeg")
    })

    test("handles December 2024 Discord image path", async () => {
      const imageBuffer = Buffer.from("fake-image-data")
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2024/12/discord/images/1234567890123456789.png"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/png")
    })
  })

  describe("V2 API: channelId, messageId, attachmentId, timestamp", () => {
    test("serves local image using v2 parameters", async () => {
      const imageBuffer = Buffer.from("fake-image-data")
      // Route checks for: .jpg, .jpeg, .png, .gif, .webp (5 extensions)
      // Let's say it finds a .jpg file (first extension)
      mockExistsSync
        .mockReturnValueOnce(true)  // .jpg file exists
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=1234567890&messageId=9876543210&attachmentId=1111111111&timestamp=20251201"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/jpeg")
      expect(mockExistsSync).toHaveBeenCalled()
      expect(mockReadFileSync).toHaveBeenCalled()
    })

    test("finds image with correct extension (.jpg)", async () => {
      const imageBuffer = Buffer.from("fake-jpg-data")
      mockExistsSync.mockReturnValueOnce(true)  // .jpg exists
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockExistsSync).toHaveBeenCalled()
    })

    test("handles latest timestamp correctly", async () => {
      const imageBuffer = Buffer.from("fake-image-data")
      mockExistsSync.mockReturnValueOnce(true)  // latest file exists
      mockReadFileSync.mockReturnValue(imageBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=latest"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockExistsSync).toHaveBeenCalled()
    })
  })

  describe("Image Resizing with Size Parameter", () => {
    beforeEach(() => {
      // Reset mock call counts
      mockSharp.resize.mockClear()
      mockSharp.jpeg.mockClear()
      mockSharp.toBuffer.mockClear()
      mockWriteFileSync.mockClear()
      mockMkdirSync.mockClear()
    })

    test("resizes image to xs size (320px)", async () => {
      const originalBuffer = Buffer.from("original-image-data")
      const resizedBuffer = Buffer.from("resized-xs-image-data")

      // Mock sequence:
      // 1. Route checks for original file (finds .jpg)
      // 2. Resize function checks if tmp dir exists
      // 3. Resize function checks if cached file exists
      mockExistsSync
        .mockReturnValueOnce(true)   // original .jpg file exists
        .mockReturnValueOnce(true)   // tmp dir exists
        .mockReturnValueOnce(false)  // cached resized file doesn't exist
      mockReadFileSync.mockReturnValue(originalBuffer)
      mockSharp.toBuffer.mockResolvedValue(resizedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201&size=xs"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/jpeg")
      expect(mockSharp.resize).toHaveBeenCalledWith(
        320,
        undefined,
        expect.objectContaining({
          width: 320,
          fit: "inside",
          withoutEnlargement: true,
        })
      )
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 85 })
      expect(mockWriteFileSync).toHaveBeenCalled()
    })

    test("resizes image to sm size (640px)", async () => {
      const originalBuffer = Buffer.from("original-image-data")
      const resizedBuffer = Buffer.from("resized-sm-image-data")

      mockExistsSync
        .mockReturnValueOnce(true)   // original file exists
        .mockReturnValueOnce(true)   // tmp dir exists
        .mockReturnValueOnce(false)  // cached file doesn't exist
      mockReadFileSync.mockReturnValue(originalBuffer)
      mockSharp.toBuffer.mockResolvedValue(resizedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201&size=sm"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockSharp.resize).toHaveBeenCalledWith(
        640,
        undefined,
        expect.objectContaining({ width: 640 })
      )
    })

    test("resizes image to md size (1024px)", async () => {
      const originalBuffer = Buffer.from("original-image-data")
      const resizedBuffer = Buffer.from("resized-md-image-data")

      mockExistsSync
        .mockReturnValueOnce(true)   // original file exists
        .mockReturnValueOnce(true)   // tmp dir exists
        .mockReturnValueOnce(false)  // cached file doesn't exist
      mockReadFileSync.mockReturnValue(originalBuffer)
      mockSharp.toBuffer.mockResolvedValue(resizedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201&size=md"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockSharp.resize).toHaveBeenCalledWith(
        1024,
        undefined,
        expect.objectContaining({ width: 1024 })
      )
    })

    test("resizes image to lg size (1920px)", async () => {
      const originalBuffer = Buffer.from("original-image-data")
      const resizedBuffer = Buffer.from("resized-lg-image-data")

      mockExistsSync
        .mockReturnValueOnce(true)   // original file exists
        .mockReturnValueOnce(true)   // tmp dir exists
        .mockReturnValueOnce(false)  // cached file doesn't exist
      mockReadFileSync.mockReturnValue(originalBuffer)
      mockSharp.toBuffer.mockResolvedValue(resizedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201&size=lg"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockSharp.resize).toHaveBeenCalledWith(
        1920,
        undefined,
        expect.objectContaining({ width: 1920 })
      )
    })

    test("serves cached resized image if it exists", async () => {
      const cachedBuffer = Buffer.from("cached-resized-image")

      // Mock: original file exists, tmp dir exists, cached file exists
      mockExistsSync
        .mockReturnValueOnce(true)  // original file exists
        .mockReturnValueOnce(true)  // tmp dir exists
        .mockReturnValueOnce(true)  // cached resized file EXISTS
      mockReadFileSync.mockReturnValue(cachedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201&size=sm"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/jpeg")
      // Sharp should NOT be called since we're serving from cache
      expect(mockSharp.resize).not.toHaveBeenCalled()
      expect(mockWriteFileSync).not.toHaveBeenCalled()
    })

    test("creates tmp directory if it doesn't exist", async () => {
      const originalBuffer = Buffer.from("original-image-data")
      const resizedBuffer = Buffer.from("resized-image-data")

      // Mock: original exists, tmp dir doesn't exist, cached doesn't exist
      mockExistsSync
        .mockReturnValueOnce(true)   // original file exists
        .mockReturnValueOnce(false)  // tmp dir doesn't exist
        .mockReturnValueOnce(false)  // cached file doesn't exist
      mockReadFileSync.mockReturnValue(originalBuffer)
      mockSharp.toBuffer.mockResolvedValue(resizedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201&size=xs"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("data/tmp"),
        expect.objectContaining({ recursive: true })
      )
    })

    test("caches resized image with correct filename format", async () => {
      const originalBuffer = Buffer.from("original-image-data")
      const resizedBuffer = Buffer.from("resized-image-data")

      mockExistsSync
        .mockReturnValueOnce(true)   // original file exists
        .mockReturnValueOnce(true)   // tmp dir exists
        .mockReturnValueOnce(false)  // cached file doesn't exist
      mockReadFileSync.mockReturnValue(originalBuffer)
      mockSharp.toBuffer.mockResolvedValue(resizedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201&size=sm"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      // Check that the file was written with the correct naming pattern
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/789-sm\.jpg$/),
        resizedBuffer
      )
    })

    test("serves original image when no size parameter is provided", async () => {
      const originalBuffer = Buffer.from("original-image-data")

      mockExistsSync.mockReturnValueOnce(true)  // original file exists
      mockReadFileSync.mockReturnValue(originalBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?channelId=123&messageId=456&attachmentId=789&timestamp=20251201"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      // Sharp should NOT be called for original
      expect(mockSharp.resize).not.toHaveBeenCalled()
      expect(mockWriteFileSync).not.toHaveBeenCalled()
    })

    test("resizes legacy URL-based images with size parameter", async () => {
      const originalBuffer = Buffer.from("original-image-data")
      const resizedBuffer = Buffer.from("resized-image-data")

      mockExistsSync
        .mockReturnValueOnce(true)   // file exists
        .mockReturnValueOnce(true)   // tmp dir exists
        .mockReturnValueOnce(false)  // cached file doesn't exist
      mockReadFileSync.mockReturnValue(originalBuffer)
      mockSharp.toBuffer.mockResolvedValue(resizedBuffer)

      const request = new NextRequest(
        "http://localhost:3000/api/image-proxy?url=/data/2025/11/discord/images/1234567890.jpg&size=md"
      )

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("image/jpeg")
      expect(mockSharp.resize).toHaveBeenCalledWith(
        1024,
        undefined,
        expect.objectContaining({ width: 1024 })
      )
    })
  })
})
