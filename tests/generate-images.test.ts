import { describe, test, expect } from "@jest/globals";
import fs from "fs";
import path from "path";

describe("Images Generation", () => {
  const channelId = "1443604524307583099";
  const TEST_YEAR = "2025";
  const TEST_MONTH = "11";
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
  const messagesPath = path.join(
    DATA_DIR,
    TEST_YEAR,
    TEST_MONTH,
    `channels/discord/${channelId}/messages.json`
  );
  const imagesPath = path.join(
    DATA_DIR,
    TEST_YEAR,
    TEST_MONTH,
    `channels/discord/${channelId}/images.json`
  );

  test("messages.json exists for test channel", () => {
    expect(fs.existsSync(messagesPath)).toBe(true);
  });

  test("images.json exists for test channel", () => {
    expect(fs.existsSync(imagesPath)).toBe(true);
  });

  test("images.json has valid structure", () => {
    const data = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    expect(data).toHaveProperty("channelId");
    expect(data).toHaveProperty("source");
    expect(data).toHaveProperty("count");
    expect(data).toHaveProperty("images");

    expect(data.channelId).toBe(channelId);
    expect(data.source).toBe(`${TEST_YEAR}-${TEST_MONTH}`);
    expect(Array.isArray(data.images)).toBe(true);
    expect(typeof data.count).toBe("number");
  });

  test("generates 5 images from 1 message with 5 attachments", () => {
    const messagesData = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
    const imagesData = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    // Verify source has 1 message with 5 attachments
    expect(messagesData.messages.length).toBe(1);
    expect(messagesData.messages[0].attachments.length).toBe(5);

    // Verify output has 5 images
    expect(imagesData.count).toBe(5);
    expect(imagesData.images.length).toBe(5);
  });

  test("all images have required fields", () => {
    const data = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    data.images.forEach((image: any) => {
      expect(image).toHaveProperty("url");
      expect(image).toHaveProperty("proxyUrl");
      expect(image).toHaveProperty("id");
      expect(image).toHaveProperty("filePath");
      expect(image).toHaveProperty("author");
      expect(image).toHaveProperty("message");
      expect(image).toHaveProperty("timestamp");
      expect(image).toHaveProperty("messageId");
      expect(image).toHaveProperty("channelId");

      expect(typeof image.url).toBe("string");
      expect(typeof image.proxyUrl).toBe("string");
      expect(typeof image.id).toBe("string");
      expect(typeof image.filePath).toBe("string");
      expect(typeof image.message).toBe("string");
      expect(typeof image.timestamp).toBe("string");
      expect(typeof image.messageId).toBe("string");
      expect(typeof image.channelId).toBe("string");

      // Author fields
      expect(image.author).toHaveProperty("id");
      expect(image.author).toHaveProperty("username");
      expect(image.author).toHaveProperty("displayName");
      expect(image.author).toHaveProperty("avatar");
    });
  });

  test("image URLs use dated paths, not /latest/ paths", () => {
    const data = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    data.images.forEach((image: any) => {
      // Should use dated path format: /data/{year}/{month}/channels/discord/images/{attachmentId}.{ext}
      expect(image.filePath).toMatch(
        /^\/data\/\d{4}\/\d{2}\/channels\/discord\/images\/\d+\.\w+$/
      );

      // Should NOT use /latest/ path
      expect(image.filePath).not.toContain("/latest/");
    });
  });

  test("image URLs are constructed from message timestamp", () => {
    const messagesData = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
    const imagesData = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    const message = messagesData.messages[0];
    const messageDate = new Date(message.timestamp);
    const expectedYear = messageDate.getFullYear();
    const expectedMonth = String(messageDate.getMonth() + 1).padStart(2, "0");
    const expectedPathPrefix = `/data/${expectedYear}/${expectedMonth}/channels/discord/images/`;

    imagesData.images.forEach((image: any) => {
      expect(image.filePath).toContain(expectedPathPrefix);
    });
  });

  test("all images reference the same message", () => {
    const messagesData = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
    const imagesData = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    const messageId = messagesData.messages[0].id;
    const messageTimestamp = messagesData.messages[0].timestamp;

    imagesData.images.forEach((image: any) => {
      expect(image.messageId).toBe(messageId);
      expect(image.timestamp).toBe(messageTimestamp);
    });
  });

  test("image URLs have proper file extensions", () => {
    const data = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

    data.images.forEach((image: any) => {
      const hasValidExtension = validExtensions.some((ext) =>
        image.filePath.endsWith(ext)
      );
      expect(hasValidExtension).toBe(true);
    });
  });

  test("image URLs do not contain query parameters", () => {
    const data = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    data.images.forEach((image: any) => {
      expect(image.filePath).not.toContain("?");
      expect(image.filePath).not.toContain("&");
    });
  });

  test("channelId matches in all images", () => {
    const data = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));

    data.images.forEach((image: any) => {
      expect(image.channelId).toBe(channelId);
    });
  });
});
