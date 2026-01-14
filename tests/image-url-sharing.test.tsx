/**
 * Test to ensure image URL sharing functionality works
 */

import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const OSTROM_CHANNEL_ID = "1443322327159803945";

describe("Image URL Sharing", () => {
  it("should have images with attachment IDs for URL sharing", () => {
    const imagesPath = path.join(
      DATA_DIR,
      "latest",
      "discord",
      OSTROM_CHANNEL_ID,
      "images.json"
    );

    expect(fs.existsSync(imagesPath)).toBe(true);

    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content);

    expect(data.images.length).toBeGreaterThan(0);

    // Check that each image has an ID (attachment ID)
    for (const image of data.images) {
      expect(image).toHaveProperty("id");
      expect(typeof image.id).toBe("string");
      expect(image.id.length).toBeGreaterThan(0);
    }
  });

  it("should have images with message IDs for Discord linking", () => {
    const imagesPath = path.join(
      DATA_DIR,
      "latest",
      "discord",
      OSTROM_CHANNEL_ID,
      "images.json"
    );

    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content);

    // Check that each image has a message ID
    for (const image of data.images) {
      expect(image).toHaveProperty("messageId");
      expect(typeof image.messageId).toBe("string");
      expect(image.messageId.length).toBeGreaterThan(0);
    }
  });

  it("should have images with author information", () => {
    const imagesPath = path.join(
      DATA_DIR,
      "latest",
      "discord",
      OSTROM_CHANNEL_ID,
      "images.json"
    );

    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content);

    // Check that each image has author information
    for (const image of data.images) {
      expect(image).toHaveProperty("author");
      expect(image.author).toHaveProperty("id");
      expect(image.author).toHaveProperty("username");
      expect(image.author).toHaveProperty("displayName");
    }
  });

  it("should have consistent channel IDs", () => {
    const imagesPath = path.join(
      DATA_DIR,
      "latest",
      "discord",
      OSTROM_CHANNEL_ID,
      "images.json"
    );

    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content);

    expect(data.channelId).toBe(OSTROM_CHANNEL_ID);

    // All images should be from the same channel
    for (const image of data.images) {
      expect(image.channelId).toBe(OSTROM_CHANNEL_ID);
    }
  });
});
