/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock the discord-cache module before any imports
jest.mock("../lib/discord-cache");

// Mock the settings
jest.mock("../src/settings/settings.json", () => ({
  discord: {
    guildId: "test-guild-id",
    channels: {
      contributions: "test-contributions-channel",
      introductions: "test-introductions-channel",
    },
  },
}));

// Mock the discord lib
jest.mock("../lib/discord", () => ({
  isDiscordConfigured: jest.fn(() => true),
  getGuild: jest.fn(async () => ({
    approximate_member_count: 100,
  })),
  getGuildChannels: jest.fn(async () => [
    { id: "test-contributions-channel", name: "contributions" },
    { id: "test-introductions-channel", name: "introductions" },
  ]),
  getChannelMessages: jest.fn(async () => []),
}));

describe("Discord Contributors API - Historical Data", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Clear module cache to reset the cachedData in the route
    jest.resetModules();
  });

  it("should include messages from 2024 without date filtering", async () => {
    // Create test messages spanning 2024 and 2025
    const testMessages = [
      // 2024 messages
      {
        id: "msg-2024-01",
        content: "Message from January 2024",
        timestamp: "2024-01-15T10:00:00Z",
        author: {
          id: "user-1",
          username: "user1",
          global_name: "User One",
          avatar: "avatar1",
          discriminator: "0001",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
      {
        id: "msg-2024-06",
        content: "Message from June 2024",
        timestamp: "2024-06-15T10:00:00Z",
        author: {
          id: "user-2",
          username: "user2",
          global_name: "User Two",
          avatar: "avatar2",
          discriminator: "0002",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
      {
        id: "msg-2024-12",
        content: "Message from December 2024",
        timestamp: "2024-12-15T10:00:00Z",
        author: {
          id: "user-3",
          username: "user3",
          global_name: "User Three",
          avatar: "avatar3",
          discriminator: "0003",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
      // 2025 messages
      {
        id: "msg-2025-01",
        content: "Message from January 2025",
        timestamp: "2025-01-15T10:00:00Z",
        author: {
          id: "user-1",
          username: "user1",
          global_name: "User One",
          avatar: "avatar1",
          discriminator: "0001",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
      {
        id: "msg-2025-12",
        content: "Message from December 2025",
        timestamp: "2025-12-01T10:00:00Z",
        author: {
          id: "user-2",
          username: "user2",
          global_name: "User Two",
          avatar: "avatar2",
          discriminator: "0002",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
    ];

    // Mock the cache functions
    const discordCache = await import("../lib/discord-cache");
    (discordCache.hasCacheData as jest.Mock).mockReturnValue(true);
    (discordCache.getAllCachedMessages as jest.Mock).mockReturnValue(testMessages);
    (discordCache.addMessagesToCache as jest.Mock).mockImplementation(() => {});

    // Import and call the API
    const { GET } = await import("../app/api/discord/contributors/route");
    const response = await GET();
    const data = await response.json();

    // Verify all messages are included (not filtered by date)
    expect(data.contributions).toBeDefined();

    // Check that we have contributions from all users (including 2024)
    const contributionUserIds = Object.keys(data.contributions);
    expect(contributionUserIds.length).toBeGreaterThanOrEqual(3);

    // Verify user-1 has contributions from both 2024 and 2025
    expect(data.contributions["user-1"]).toBeDefined();
    expect(data.contributions["user-1"].length).toBeGreaterThanOrEqual(2);

    // Verify specific 2024 messages are included
    const user1Contributions = data.contributions["user-1"];
    const has2024Message = user1Contributions.some(
      (c: { timestamp: string }) => c.timestamp.startsWith("2024")
    );
    const has2025Message = user1Contributions.some(
      (c: { timestamp: string }) => c.timestamp.startsWith("2025")
    );

    expect(has2024Message).toBe(true);
    expect(has2025Message).toBe(true);

    // Verify user-2 has contributions from 2024 and 2025
    expect(data.contributions["user-2"]).toBeDefined();
    const user2Contributions = data.contributions["user-2"];
    const user2Has2024 = user2Contributions.some(
      (c: { timestamp: string }) => c.timestamp.startsWith("2024")
    );
    expect(user2Has2024).toBe(true);

    // Verify user-3 from 2024 is included
    expect(data.contributions["user-3"]).toBeDefined();
  });

  it("should not apply 6-month date filter to cached messages", async () => {
    const now = new Date();
    const eightMonthsAgo = new Date(now);
    eightMonthsAgo.setMonth(now.getMonth() - 8);

    const oldMessage = {
      id: "msg-old",
      content: "Message from 8 months ago",
      timestamp: eightMonthsAgo.toISOString(),
      author: {
        id: "user-old",
        username: "olduser",
        global_name: "Old User",
        avatar: "avatar-old",
        discriminator: "0000",
      },
      mentions: [],
      attachments: [],
      embeds: [],
    };

    const recentMessage = {
      id: "msg-recent",
      content: "Recent message",
      timestamp: now.toISOString(),
      author: {
        id: "user-recent",
        username: "recentuser",
        global_name: "Recent User",
        avatar: "avatar-recent",
        discriminator: "0000",
      },
      mentions: [],
      attachments: [],
      embeds: [],
    };

    const discordCache = await import("../lib/discord-cache");
    (discordCache.hasCacheData as jest.Mock).mockReturnValue(true);
    (discordCache.getAllCachedMessages as jest.Mock).mockReturnValue([
      oldMessage,
      recentMessage,
    ]);
    (discordCache.addMessagesToCache as jest.Mock).mockImplementation(() => {});

    const { GET } = await import("../app/api/discord/contributors/route");
    const response = await GET();
    const data = await response.json();

    // Verify both old and recent messages are included
    expect(data.contributions["user-old"]).toBeDefined();
    expect(data.contributions["user-recent"]).toBeDefined();

    // Verify the old message (8 months ago) is in contributions
    const oldUserContribs = data.contributions["user-old"];
    expect(oldUserContribs.length).toBeGreaterThan(0);
    expect(oldUserContribs[0].content).toBe("Message from 8 months ago");
  });

  it("should calculate contributor joinedAt from earliest message", async () => {
    const testMessages = [
      {
        id: "msg-1",
        content: "First message",
        timestamp: "2024-03-15T10:00:00Z",
        author: {
          id: "user-1",
          username: "user1",
          global_name: "User One",
          avatar: "avatar1",
          discriminator: "0001",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
      {
        id: "msg-2",
        content: "Later message",
        timestamp: "2025-06-15T10:00:00Z",
        author: {
          id: "user-1",
          username: "user1",
          global_name: "User One",
          avatar: "avatar1",
          discriminator: "0001",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
    ];

    const discordCache = await import("../lib/discord-cache");
    (discordCache.hasCacheData as jest.Mock).mockReturnValue(true);
    (discordCache.getAllCachedMessages as jest.Mock).mockReturnValue(testMessages);
    (discordCache.addMessagesToCache as jest.Mock).mockImplementation(() => {});

    const { GET } = await import("../app/api/discord/contributors/route");
    const response = await GET();
    const data = await response.json();

    // Verify joinedAt reflects the earliest message
    const contributor = data.contributors.find((c: { id: string }) => c.id === "user-1");
    expect(contributor).toBeDefined();
    expect(contributor.joinedAt).toBe("2024-03-15T10:00:00Z");
  });

  it("should include introductions from all time periods", async () => {
    const testIntroductions = [
      {
        id: "intro-2024",
        content: "Hello everyone! This is my introduction from 2024.",
        timestamp: "2024-03-15T10:00:00Z",
        author: {
          id: "user-intro-1",
          username: "newuser2024",
          global_name: "New User 2024",
          avatar: "avatar-intro-1",
          discriminator: "0001",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
      {
        id: "intro-2025",
        content: "Hi! Joining in 2025!",
        timestamp: "2025-01-15T10:00:00Z",
        author: {
          id: "user-intro-2",
          username: "newuser2025",
          global_name: "New User 2025",
          avatar: "avatar-intro-2",
          discriminator: "0002",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      },
    ];

    const discordCache = await import("../lib/discord-cache");
    (discordCache.hasCacheData as jest.Mock).mockImplementation((channelId: string) => {
      return true;
    });

    (discordCache.getAllCachedMessages as jest.Mock).mockImplementation(
      (channelId: string) => {
        // Return introductions for introductions channel
        if (channelId === "test-introductions-channel") {
          return testIntroductions;
        }
        return [];
      }
    );

    (discordCache.addMessagesToCache as jest.Mock).mockImplementation(() => {});

    const { GET } = await import("../app/api/discord/contributors/route");
    const response = await GET();
    const data = await response.json();

    // Verify both 2024 and 2025 introductions are included
    expect(data.introductions).toBeDefined();
    expect(data.introductions["user-intro-1"]).toBeDefined();
    expect(data.introductions["user-intro-2"]).toBeDefined();

    // Verify content is preserved
    expect(data.introductions["user-intro-1"][0].content).toContain("2024");
    expect(data.introductions["user-intro-2"][0].content).toContain("2025");
  });

  it("should process all historical messages for contribution counts", async () => {
    // User with many messages across 2024 and 2025
    const messages = [];
    for (let i = 0; i < 12; i++) {
      messages.push({
        id: `msg-2024-${i}`,
        content: `Message ${i} from 2024`,
        timestamp: `2024-${String(i + 1).padStart(2, "0")}-15T10:00:00Z`,
        author: {
          id: "power-user",
          username: "poweruser",
          global_name: "Power User",
          avatar: "avatar-power",
          discriminator: "0001",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      });
    }
    for (let i = 0; i < 12; i++) {
      messages.push({
        id: `msg-2025-${i}`,
        content: `Message ${i} from 2025`,
        timestamp: `2025-${String(i + 1).padStart(2, "0")}-15T10:00:00Z`,
        author: {
          id: "power-user",
          username: "poweruser",
          global_name: "Power User",
          avatar: "avatar-power",
          discriminator: "0001",
        },
        mentions: [],
        attachments: [],
        embeds: [],
      });
    }

    const discordCache = await import("../lib/discord-cache");
    (discordCache.hasCacheData as jest.Mock).mockReturnValue(true);
    (discordCache.getAllCachedMessages as jest.Mock).mockReturnValue(messages);
    (discordCache.addMessagesToCache as jest.Mock).mockImplementation(() => {});

    const { GET } = await import("../app/api/discord/contributors/route");
    const response = await GET();
    const data = await response.json();

    // Verify contribution count includes all 24 messages
    const contributor = data.contributors.find((c: { id: string }) => c.id === "power-user");
    expect(contributor).toBeDefined();
    expect(contributor.contributionCount).toBe(24);

    // Verify contributions list includes all messages
    expect(data.contributions["power-user"]).toBeDefined();
    expect(data.contributions["power-user"].length).toBe(24);

    // Verify total count
    expect(data.contributionsTotalCount["power-user"]).toBe(24);
  });
});
