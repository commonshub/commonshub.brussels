/**
 * Test the /data API route
 */

import { GET } from "../src/app/data/[...path]/route";
import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

describe("/data API route", () => {
  it("should serve a JSON file from DATA_DIR", async () => {
    // Create a test file
    const testDir = path.join(DATA_DIR, "test");
    const testFile = path.join(testDir, "test.json");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testFile, JSON.stringify({ test: "data" }));

    try {
      const request = new NextRequest("http://localhost:3000/data/test/test.json");
      const params = Promise.resolve({ path: ["test", "test.json"] });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ test: "data" });
    } finally {
      // Cleanup
      fs.unlinkSync(testFile);
      fs.rmdirSync(testDir);
    }
  });

  it("should block access to private paths", async () => {
    const request = new NextRequest("http://localhost:3000/data/2025/01/private/test.json");
    const params = Promise.resolve({ path: ["2025", "01", "private", "test.json"] });
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("private");
  });

  it("should return 404 for non-existent files", async () => {
    const request = new NextRequest("http://localhost:3000/data/nonexistent.json");
    const params = Promise.resolve({ path: ["nonexistent.json"] });
    const response = await GET(request, { params });

    expect(response.status).toBe(404);
  });

  it("should block directory listing", async () => {
    const request = new NextRequest("http://localhost:3000/data/latest");
    const params = Promise.resolve({ path: ["latest"] });
    const response = await GET(request, { params });

    // Either 403 (forbidden) or 404 (not found) is acceptable for blocking directory listing
    expect([403, 404]).toContain(response.status);
  });

  it("should block path traversal attempts", async () => {
    const request = new NextRequest("http://localhost:3000/data/../../../etc/passwd");
    const params = Promise.resolve({ path: ["..", "..", "..", "etc", "passwd"] });
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
  });

  it("should serve images with correct content type", async () => {
    // Create a test image file
    const testDir = path.join(DATA_DIR, "test");
    const testFile = path.join(testDir, "test.jpg");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testFile, Buffer.from([0xff, 0xd8, 0xff, 0xe0])); // JPEG header

    try {
      const request = new NextRequest("http://localhost:3000/data/test/test.jpg");
      const params = Promise.resolve({ path: ["test", "test.jpg"] });
      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    } finally {
      // Cleanup
      fs.unlinkSync(testFile);
      fs.rmdirSync(testDir);
    }
  });
});
