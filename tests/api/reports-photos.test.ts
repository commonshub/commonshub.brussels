/**
 * @jest-environment node
 *
 * Photos come from the tier's images.json. chb stores its copy of each
 * attachment under YYYY/MM/providers/discord/images and points at it with
 * `filePath`; the site turns that into an image-proxy URL. The public tier
 * ships photos without their message text.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chb-photos-"));

function writeJson(rel: string, data: unknown) {
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

const image = (id: string, reactions: number, message = "") => ({
  url: `https://cdn.discordapp.com/attachments/1/${id}/x.jpg?ex=1`,
  id,
  author: { id: `u${id}`, username: `user${id}`, displayName: `User ${id}`, avatar: null },
  reactions: [{ emoji: "❤️", count: reactions }],
  totalReactions: reactions,
  message,
  timestamp: `2025-03-0${id}T10:00:00+00:00`,
  channelId: "c1",
  messageId: `m${id}`,
  filePath: `2025/03/providers/discord/images/${id}.jpg`,
});

let reports: typeof import("@/lib/reports");

beforeAll(() => {
  writeJson("2025/03/public/images.json", { images: [image("1", 2), image("2", 9), image("3", 5)] });
  writeJson("2025/03/members/images.json", { images: [image("1", 2, "hello"), image("2", 9, "world")] });
  writeJson("2025/03/public/contributors.json", { summary: { totalContributors: 1 }, contributors: [{ id: "u1", profile: { username: "user1", name: "User 1" } }] });
  process.env.DATA_DIR = tmp;
  jest.isolateModules(() => {
    reports = require("@/lib/reports");
  });
});

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("tiered photo readers", () => {
  it("maps filePath to an image-proxy path and defaults the message", () => {
    const photos = reports.readGeneratedImages("2025", "03");
    expect(photos).toHaveLength(3);
    expect(photos[0].proxyUrl).toBe("/data/2025/03/providers/discord/images/1.jpg");
    expect(photos[0].message).toBe("");
    expect(photos[0].reactions[0]).toEqual({ emoji: "❤️", count: 2, me: false });
  });

  it("reads the members tier when asked, and only then sees message text", () => {
    const photos = reports.readGeneratedImages("2025", "03", "members");
    expect(photos.map((p) => p.message)).toEqual(["hello", "world"]);
  });

  it("returns nothing for a month without the file", () => {
    expect(reports.readGeneratedImages("2025", "04")).toEqual([]);
    expect(reports.readYearlyImages("2025")).toEqual([]);
  });

  it("ranks popular photos by reactions and lists their authors", () => {
    const popular = reports.popularPhotos(reports.readGeneratedImages("2025", "03"), 2);
    expect(popular.map((p) => p.id)).toEqual(["2", "3"]);
    expect(reports.photoAuthors(popular).userIds).toEqual(["u2", "u3"]);
  });

  it("builds the monthly report from the public tier", () => {
    const report = reports.getMonthlyReportData("2025", "03");
    expect(report.photos.map((p) => p.id)).toEqual(["2", "3", "1"]);
    expect(report.activeMembers.userIds).toEqual(["u1"]);
    report.photos.forEach((photo) => {
      expect(photo.channelId).toBe("c1");
      expect(photo.messageId).toMatch(/^m/);
    });
  });
});
