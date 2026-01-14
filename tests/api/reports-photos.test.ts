/**
 * @jest-environment node
 */

import { describe, it, expect } from "@jest/globals";
import {
  readDiscordMessages,
  getAllPhotos,
  getPopularPhotos,
  getMonthlyReportData,
} from "@/lib/reports";

describe("Photos API - channelId and messageId validation", () => {
  const testYear = "2025";
  const testMonth = "03";

  describe("readDiscordMessages", () => {
    it("should add channel_id to messages when reading from files", () => {
      const messages = readDiscordMessages(testYear, testMonth);

      if (messages.length === 0) {
        console.log(`⚠️  No messages found for ${testYear}/${testMonth}`);
        return;
      }

      console.log(`Found ${messages.length} messages`);

      // Check that messages have channel_id
      const messagesWithChannelId = messages.filter((msg) => msg.channel_id);
      console.log(
        `Messages with channel_id: ${messagesWithChannelId.length}/${messages.length}`
      );

      expect(messagesWithChannelId.length).toBeGreaterThan(0);

      // Log first message
      const firstMsg = messages[0];
      console.log("First message:", {
        id: firstMsg.id,
        channel_id: firstMsg.channel_id,
        hasAttachments: !!firstMsg.attachments?.length,
      });
    });
  });

  describe("getAllPhotos", () => {
    it("should return photos with channelId and messageId", () => {
      const messages = readDiscordMessages(testYear, testMonth);

      if (messages.length === 0) {
        console.log(`⚠️  No messages found for ${testYear}/${testMonth}`);
        return;
      }

      const photos = getAllPhotos(messages);

      if (photos.length === 0) {
        console.log("⚠️  No photos found in messages");
        return;
      }

      console.log(`Found ${photos.length} photos`);

      // Check all photos
      photos.forEach((photo, index) => {
        // Required fields
        expect(photo).toHaveProperty("url");
        expect(photo).toHaveProperty("messageId");
        expect(photo).toHaveProperty("channelId");
        expect(photo).toHaveProperty("author");
        expect(photo).toHaveProperty("reactions");

        // Verify channelId and messageId are not empty
        expect(photo.channelId).toBeTruthy();
        expect(photo.messageId).toBeTruthy();
        expect(typeof photo.channelId).toBe("string");
        expect(typeof photo.messageId).toBe("string");
        expect(photo.channelId).not.toBe("");
        expect(photo.messageId).not.toBe("");

        // Verify reactions have 'me' field
        expect(Array.isArray(photo.reactions)).toBe(true);
        if (photo.reactions.length > 0) {
          photo.reactions.forEach((reaction) => {
            expect(reaction).toHaveProperty("me");
            expect(typeof reaction.me).toBe("boolean");
          });
        }

        // Log first photo details
        if (index === 0) {
          console.log("First photo:", {
            messageId: photo.messageId,
            channelId: photo.channelId,
            url: photo.url.substring(0, 50) + "...",
            reactions: photo.reactions.map((r) => ({
              emoji: r.emoji,
              count: r.count,
              me: r.me,
            })),
          });
        }
      });

      console.log(`✅ All ${photos.length} photos have channelId and messageId`);
      console.log(`✅ All reactions have 'me' field`);
    });
  });

  describe("getPopularPhotos", () => {
    it("should return photos with channelId and messageId", () => {
      const messages = readDiscordMessages(testYear, testMonth);

      if (messages.length === 0) {
        console.log(`⚠️  No messages found for ${testYear}/${testMonth}`);
        return;
      }

      const photos = getPopularPhotos(messages, 12);

      if (photos.length === 0) {
        console.log("⚠️  No photos found in messages");
        return;
      }

      console.log(`Found ${photos.length} popular photos`);

      // Check all photos
      photos.forEach((photo) => {
        expect(photo).toHaveProperty("channelId");
        expect(photo).toHaveProperty("messageId");
        expect(photo.channelId).toBeTruthy();
        expect(photo.messageId).toBeTruthy();
        expect(photo.channelId).not.toBe("");
        expect(photo.messageId).not.toBe("");

        // Verify reactions have 'me' field
        if (photo.reactions.length > 0) {
          photo.reactions.forEach((reaction) => {
            expect(reaction).toHaveProperty("me");
          });
        }
      });

      console.log(`✅ All popular photos have channelId and messageId`);
    });
  });

  describe("getMonthlyReportData", () => {
    it("should return report with photos containing channelId and messageId", () => {
      const report = getMonthlyReportData(testYear, testMonth);

      expect(report).toHaveProperty("year");
      expect(report).toHaveProperty("month");
      expect(report).toHaveProperty("photos");
      expect(report).toHaveProperty("activeMembers");
      expect(report).toHaveProperty("financials");

      expect(report.year).toBe(testYear);
      expect(report.month).toBe(testMonth);

      if (report.photos.length === 0) {
        console.log("⚠️  No photos in monthly report");
        return;
      }

      console.log(`Monthly report has ${report.photos.length} photos`);

      // Check all photos in report
      report.photos.forEach((photo, index) => {
        expect(photo).toHaveProperty("channelId");
        expect(photo).toHaveProperty("messageId");
        expect(photo.channelId).toBeTruthy();
        expect(photo.messageId).toBeTruthy();
        expect(photo.channelId).not.toBe("");
        expect(photo.messageId).not.toBe("");

        // Log first photo
        if (index === 0) {
          console.log("Monthly report first photo:", {
            messageId: photo.messageId,
            channelId: photo.channelId,
            reactionsWithMe: photo.reactions.map((r) => ({
              emoji: r.emoji,
              me: r.me,
            })),
          });
        }
      });

      console.log(`✅ All photos in monthly report have channelId and messageId`);
    });
  });
});
