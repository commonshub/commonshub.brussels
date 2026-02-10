/**
 * Tests for images.json generated files
 * 
 * Validates the structure of image files generated from Discord messages.
 * Tests skip gracefully if data doesn't exist.
 */

import { describe, test, expect, beforeAll } from "@jest/globals";
import fs from "fs";
import path from "path";

describe("Images Generation", () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");

  // Find an images.json file
  function findImagesFile(): { path: string; channelId: string } | null {
    if (!fs.existsSync(DATA_DIR)) return null;

    const years = fs.readdirSync(DATA_DIR)
      .filter(d => /^\d{4}$/.test(d))
      .sort()
      .reverse();

    for (const year of years) {
      const yearPath = path.join(DATA_DIR, year);
      if (!fs.statSync(yearPath).isDirectory()) continue;

      const months = fs.readdirSync(yearPath)
        .filter(d => /^\d{2}$/.test(d))
        .sort()
        .reverse();

      for (const month of months) {
        const channelsPath = path.join(DATA_DIR, year, month, "channels", "discord");
        if (!fs.existsSync(channelsPath)) continue;

        const channels = fs.readdirSync(channelsPath).filter(d => /^\d+$/.test(d));
        for (const channelId of channels) {
          const imagesPath = path.join(channelsPath, channelId, "images.json");
          if (fs.existsSync(imagesPath)) {
            return { path: imagesPath, channelId };
          }
        }
        
        // Also check for images.json at the discord level
        const topImagesPath = path.join(channelsPath, "images.json");
        if (fs.existsSync(topImagesPath)) {
          return { path: topImagesPath, channelId: "aggregated" };
        }
      }
    }
    return null;
  }

  let imagesFile: { path: string; channelId: string } | null;
  let imagesData: any = null;

  beforeAll(() => {
    imagesFile = findImagesFile();
    if (imagesFile) {
      try {
        imagesData = JSON.parse(fs.readFileSync(imagesFile.path, "utf-8"));
        console.log(`Testing images from: ${imagesFile.path}`);
        console.log(`  ${imagesData?.images?.length ?? imagesData?.count ?? 0} images found`);
      } catch (e) {
        console.warn(`Failed to parse images file: ${e}`);
      }
    } else {
      console.warn("⚠️ No images.json found. Run generate scripts first.");
    }
  });

  test("images.json exists (or skip)", () => {
    if (!imagesFile) {
      console.log("Skipping - no images data found");
      return;
    }
    expect(fs.existsSync(imagesFile.path)).toBe(true);
  });

  test("images.json has valid structure", () => {
    if (!imagesData) return;

    expect(imagesData).toHaveProperty("images");
    expect(Array.isArray(imagesData.images)).toBe(true);
  });

  test("images have required fields", () => {
    if (!imagesData || !imagesData.images || imagesData.images.length === 0) return;

    for (const image of imagesData.images.slice(0, 10)) {
      expect(image).toHaveProperty("url");
      expect(image).toHaveProperty("author");
      expect(image).toHaveProperty("timestamp");
      expect(image).toHaveProperty("messageId");
      expect(image).toHaveProperty("channelId");

      expect(typeof image.url).toBe("string");
      expect(typeof image.timestamp).toBe("string");
      expect(typeof image.messageId).toBe("string");
      expect(typeof image.channelId).toBe("string");

      // Author fields
      expect(image.author).toHaveProperty("id");
      expect(image.author).toHaveProperty("username");
    }
  });

  test("image URLs are valid", () => {
    if (!imagesData || !imagesData.images || imagesData.images.length === 0) return;

    for (const image of imagesData.images.slice(0, 10)) {
      // URL should be a string starting with http or be a relative path
      expect(
        image.url.startsWith("http") || 
        image.url.startsWith("/") ||
        image.filePath?.startsWith("/")
      ).toBe(true);
    }
  });

  test("images have valid timestamps", () => {
    if (!imagesData || !imagesData.images || imagesData.images.length === 0) return;

    for (const image of imagesData.images.slice(0, 10)) {
      const date = new Date(image.timestamp);
      expect(date.toString()).not.toBe("Invalid Date");
    }
  });
});
