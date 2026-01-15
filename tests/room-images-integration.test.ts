/**
 * Integration test: Verify room images can be loaded
 */

import { GET } from "../src/app/data/[...path]/route";
import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

describe("Room images integration", () => {
  it("should load ostrom room images via /data API", async () => {
    const ostromChannelId = "1443322327159803945";
    const imagePath = path.join(
      DATA_DIR,
      "latest/discord",
      ostromChannelId,
      "images.json"
    );

    // Skip if data doesn't exist (CI environment)
    if (!fs.existsSync(imagePath)) {
      console.log("Skipping test: ostrom images data not found");
      return;
    }

    const request = new NextRequest(
      `http://localhost:3000/data/latest/discord/${ostromChannelId}/images.json`
    );
    const params = Promise.resolve({
      path: ["latest", "discord", ostromChannelId, "images.json"],
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const data = await response.json();
    expect(data).toHaveProperty("images");
    expect(Array.isArray(data.images)).toBe(true);
    expect(data.images.length).toBeGreaterThan(0);

    // Verify image structure
    const firstImage = data.images[0];
    expect(firstImage).toHaveProperty("id");
    expect(firstImage).toHaveProperty("author");
    expect(firstImage).toHaveProperty("timestamp");
  });

  it("should block access to private calendar data", async () => {
    const request = new NextRequest(
      "http://localhost:3000/data/2025/01/calendars/luma/private/guests/evt-test.json"
    );
    const params = Promise.resolve({
      path: ["2025", "01", "calendars", "luma", "private", "guests", "evt-test.json"],
    });
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
  });
});
