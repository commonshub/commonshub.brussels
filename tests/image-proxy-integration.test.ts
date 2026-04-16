/**
 * Image Proxy Integration Tests
 * Tests local-file and external URL handling through image-proxy
 * 
 * These are INTEGRATION tests that require network access.
 * They are skipped in CI unless INTEGRATION_TESTS=true is set.
 * 
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, beforeAll } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET as GET_IMAGE } from "@/app/api/image-proxy/route";
import fs from "fs";
import path from "path";

// Skip integration tests in CI unless explicitly enabled
const SKIP_INTEGRATION = process.env.CI === "true" && process.env.INTEGRATION_TESTS !== "true";

const TEST_LOCAL_IMAGE = {
  path: "/data/2025/11/calendars/ical/images/evt-31Y15JveRh4IHaq.jpg",
  imageId: "evt-31Y15JveRh4IHaq",
};

const TEST_EXTERNAL_IMAGE = {
  url: "https://pbs.twimg.com/profile_images/1799160927750680576/KPNr_sNq_400x400.jpg",
};

describe("Image Proxy Integration Tests", () => {
  // Use tests/data directory to avoid messing with production data
  const testDataDir = path.join(process.cwd(), "tests", "data");
  const tmpDir = path.join(testDataDir, "tmp");

  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log("⏭️  Skipping image proxy integration tests in CI");
      console.log("   Set INTEGRATION_TESTS=true to run these tests");
      return;
    }
    // Set DATA_DIR environment variable for tests
    process.env.DATA_DIR = testDataDir;
    console.log(`📁 Using test data directory: ${testDataDir}`);
  });

  const getCachedFilePath = (imageId: string, size: string) => {
    return path.join(tmpDir, `${imageId}-${size}.jpg`);
  };

  const cleanupTestFiles = (imageId: string) => {
    const sizes = ["xs", "sm", "md", "lg"];
    sizes.forEach((size) => {
      const filePath = getCachedFilePath(imageId, size);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up test file: ${filePath}`);
      }
    });
  };

  beforeEach(() => {
    // Remove any existing cached files before each test
    cleanupTestFiles(TEST_LOCAL_IMAGE.imageId);
    // Create hash for external image URL
    const crypto = require("crypto");
    const externalImageId = crypto
      .createHash("md5")
      .update(TEST_EXTERNAL_IMAGE.url)
      .digest("hex");
    cleanupTestFiles(externalImageId);
  });

  describe("Local Data Path Image Proxy", () => {
    test("resizes local image to xs (320px) and caches it", async () => {
      if (SKIP_INTEGRATION) return;
      const size = "xs";
      const cachedFilePath = getCachedFilePath(TEST_LOCAL_IMAGE.imageId, size);

      // Verify file doesn't exist before test
      expect(fs.existsSync(cachedFilePath)).toBe(false);

      const request = new NextRequest(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(TEST_LOCAL_IMAGE.path)}&size=${size}`
      );

      console.log(`\n📸 Testing local image resize to ${size}`);
      console.log(`📁 Expected cache path: ${cachedFilePath}`);

      const response = await GET_IMAGE(request);

      // Check response is successful
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/jpeg");

      // Check that file was created
      expect(fs.existsSync(cachedFilePath)).toBe(true);
      console.log(`✅ Cached file created: ${cachedFilePath}`);

      // Check file size is > 10KB
      const stats = fs.statSync(cachedFilePath);
      const fileSizeKB = stats.size / 1024;
      console.log(`📊 File size: ${fileSizeKB.toFixed(2)} KB`);
      expect(stats.size).toBeGreaterThan(10 * 1024); // > 10KB

      // Verify it's a valid JPEG by checking magic bytes
      const buffer = fs.readFileSync(cachedFilePath);
      const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8;
      expect(isJPEG).toBe(true);
      console.log(`✅ File is valid JPEG format\n`);
    }, 30000); // 30 second timeout for network requests

    test("resizes local image to sm (640px) and caches it", async () => {
      if (SKIP_INTEGRATION) return;
      const size = "sm";
      const cachedFilePath = getCachedFilePath(TEST_LOCAL_IMAGE.imageId, size);

      expect(fs.existsSync(cachedFilePath)).toBe(false);

      const request = new NextRequest(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(TEST_LOCAL_IMAGE.path)}&size=${size}`
      );

      console.log(`\n📸 Testing local image resize to ${size}`);
      console.log(`📁 Expected cache path: ${cachedFilePath}`);

      const response = await GET_IMAGE(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/jpeg");

      expect(fs.existsSync(cachedFilePath)).toBe(true);
      console.log(`✅ Cached file created: ${cachedFilePath}`);

      const stats = fs.statSync(cachedFilePath);
      const fileSizeKB = stats.size / 1024;
      console.log(`📊 File size: ${fileSizeKB.toFixed(2)} KB`);
      expect(stats.size).toBeGreaterThan(10 * 1024);

      const buffer = fs.readFileSync(cachedFilePath);
      const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8;
      expect(isJPEG).toBe(true);
      console.log(`✅ File is valid JPEG format\n`);
    }, 30000);

    test("serves local image from cache on second request", async () => {
      if (SKIP_INTEGRATION) return;
      const size = "xs";
      const cachedFilePath = getCachedFilePath(TEST_LOCAL_IMAGE.imageId, size);

      const request = new NextRequest(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(TEST_LOCAL_IMAGE.path)}&size=${size}`
      );

      console.log(`\n🔄 Testing local image cache serving`);
      console.log(`📁 Cache path: ${cachedFilePath}`);

      // First request - creates cache
      const response1 = await GET_IMAGE(request);
      expect(response1.status).toBe(200);
      expect(fs.existsSync(cachedFilePath)).toBe(true);

      const stats1 = fs.statSync(cachedFilePath);
      const mtime1 = stats1.mtime.getTime();
      console.log(`📊 First request - file created at: ${new Date(mtime1).toISOString()}`);

      // Wait a bit to ensure mtime would change if file was rewritten
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second request - should serve from cache
      const response2 = await GET_IMAGE(request);
      expect(response2.status).toBe(200);

      const stats2 = fs.statSync(cachedFilePath);
      const mtime2 = stats2.mtime.getTime();
      console.log(`📊 Second request - file mtime: ${new Date(mtime2).toISOString()}`);

      // File modification time should be the same (not rewritten)
      expect(mtime1).toBe(mtime2);
      console.log(`✅ File served from cache without re-resizing\n`);
    }, 30000);
  });

  describe("External Image Proxy", () => {
    test("proxies external Twitter/X image and resizes to sm", async () => {
      if (SKIP_INTEGRATION) return;
      const size = "sm";
      const crypto = require("crypto");
      const imageId = crypto
        .createHash("md5")
        .update(TEST_EXTERNAL_IMAGE.url)
        .digest("hex");
      const cachedFilePath = getCachedFilePath(imageId, size);

      // Verify file doesn't exist before test
      expect(fs.existsSync(cachedFilePath)).toBe(false);

      const request = new NextRequest(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(TEST_EXTERNAL_IMAGE.url)}&size=${size}`
      );

      console.log(`\n📸 Testing external image proxy with Twitter image`);
      console.log(`🌐 URL: ${TEST_EXTERNAL_IMAGE.url}`);
      console.log(`📁 Expected cache path: ${cachedFilePath}`);

      const response = await GET_IMAGE(request);

      // Check response is successful
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/jpeg");

      // Check that file was created
      expect(fs.existsSync(cachedFilePath)).toBe(true);
      console.log(`✅ Cached file created: ${cachedFilePath}`);

      // Check file size is > 1KB
      const stats = fs.statSync(cachedFilePath);
      const fileSizeKB = stats.size / 1024;
      console.log(`📊 File size: ${fileSizeKB.toFixed(2)} KB`);
      expect(stats.size).toBeGreaterThan(1 * 1024); // > 1KB

      // Verify it's a valid JPEG
      const buffer = fs.readFileSync(cachedFilePath);
      const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8;
      expect(isJPEG).toBe(true);
      console.log(`✅ File is valid JPEG format\n`);
    }, 30000);

    test("proxies external image without resizing", async () => {
      if (SKIP_INTEGRATION) return;
      const request = new NextRequest(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(TEST_EXTERNAL_IMAGE.url)}`
      );

      console.log(`\n📸 Testing external image proxy without resizing`);
      console.log(`🌐 URL: ${TEST_EXTERNAL_IMAGE.url}`);

      const response = await GET_IMAGE(request);

      // Check response is successful
      expect(response.status).toBe(200);
      // Content type should be the original image type (likely image/jpeg)
      const contentType = response.headers.get("Content-Type");
      expect(contentType).toMatch(/^image\//);

      console.log(`✅ Image proxied successfully without resizing`);
      console.log(`📊 Content-Type: ${contentType}\n`);
    }, 30000);

    test("returns error for non-allowed domain", async () => {
      if (SKIP_INTEGRATION) return;
      const badUrl = "https://example.com/image.jpg";
      const request = new NextRequest(
        `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(badUrl)}`
      );

      console.log(`\n🚫 Testing domain blocking`);
      console.log(`🌐 URL: ${badUrl}`);

      const response = await GET_IMAGE(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Domain not allowed");

      console.log(`✅ Correctly blocked non-allowed domain\n`);
    }, 10000);
  });

  describe("Local Image File Size Progression", () => {
    test("local image file sizes decrease with smaller size parameters", async () => {
      if (SKIP_INTEGRATION) return;
      console.log(`\n📏 Testing local image size progression`);

      const sizes = ["lg", "md", "sm", "xs"];
      const fileSizes: Record<string, number> = {};

      for (const size of sizes) {
        const request = new NextRequest(
          `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(TEST_LOCAL_IMAGE.path)}&size=${size}`
        );

        const response = await GET_IMAGE(request);
        expect(response.status).toBe(200);

        const cachedFilePath = getCachedFilePath(TEST_LOCAL_IMAGE.imageId, size);
        const stats = fs.statSync(cachedFilePath);
        fileSizes[size] = stats.size;
        console.log(`📊 ${size}: ${(stats.size / 1024).toFixed(2)} KB`);
      }

      // Generally, smaller sizes should have smaller file sizes
      expect(fileSizes.xs).toBeLessThan(fileSizes.lg);
      console.log(`✅ File sizes follow expected pattern\n`);
    }, 60000);
  });
});
