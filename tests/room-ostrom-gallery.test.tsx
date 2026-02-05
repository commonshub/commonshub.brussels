/**
 * @jest-environment jsdom
 */
/**
 * Test to ensure the Ostrom room gallery loads correctly
 * This test prevents regressions where images.json files aren't generated for latest Discord data
 */

import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

describe("Ostrom Room Gallery", () => {
  const OSTROM_CHANNEL_ID = "1443322327159803945";

  it("should have generated images.json in latest/discord/{channelId}", () => {
    const imagesPath = path.join(
      DATA_DIR,
      "latest",
      "channels", "discord",
      OSTROM_CHANNEL_ID,
      "images.json"
    );

    // Check if file exists
    expect(fs.existsSync(imagesPath)).toBe(true);

    // Check if file has valid JSON structure
    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content);

    expect(data).toHaveProperty("channelId", OSTROM_CHANNEL_ID);
    expect(data).toHaveProperty("source", "latest");
    expect(data).toHaveProperty("count");
    expect(data).toHaveProperty("images");
    expect(Array.isArray(data.images)).toBe(true);
  });

  it("should have images with proper structure", () => {
    const imagesPath = path.join(
      DATA_DIR,
      "latest",
      "channels", "discord",
      OSTROM_CHANNEL_ID,
      "images.json"
    );

    const content = fs.readFileSync(imagesPath, "utf-8");
    const data = JSON.parse(content);

    if (data.images.length > 0) {
      const firstImage = data.images[0];

      expect(firstImage).toHaveProperty("id");
      expect(firstImage).toHaveProperty("messageId");
      expect(firstImage).toHaveProperty("channelId");
      expect(firstImage).toHaveProperty("timestamp");
      expect(firstImage).toHaveProperty("url");
      expect(firstImage).toHaveProperty("author");
      expect(firstImage.author).toHaveProperty("id");
      expect(firstImage.author).toHaveProperty("username");
      expect(firstImage.author).toHaveProperty("displayName");
    }
  });

  it("should generate images.json for all room channels", () => {
    const roomsData = require("../src/settings/rooms.json");

    for (const room of roomsData.rooms) {
      const channelId = room.discordChannelId;
      if (!channelId) continue;

      const messagesPath = path.join(
        DATA_DIR,
        "latest",
        "channels", "discord",
        channelId,
        "messages.json"
      );

      // Only check if messages.json exists (room might not have messages yet)
      if (fs.existsSync(messagesPath)) {
        const messages = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));

        // Check if there are any image attachments
        const hasImages = messages.messages?.some(
          (msg: any) =>
            msg.attachments?.some(
              (att: any) =>
                att.content_type?.startsWith("image/") ||
                att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            )
        );

        // If there are images in messages, images.json should exist
        if (hasImages) {
          const imagesPath = path.join(
            DATA_DIR,
            "latest",
            "channels", "discord",
            channelId,
            "images.json"
          );

          expect(fs.existsSync(imagesPath)).toBe(true);
        }
      }
    }
  });
});
