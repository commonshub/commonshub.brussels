/**
 * Generate derived data files from cached data
 *
 * This script processes cached data and generates:
 * - Discord data:
 *   - data/:year/:month/discord/images.json - Images with reactions for each month
 *   - data/latest/discord/images.json - Latest images (from most recent month)
 *   - data/:year/:month/discord/:channelId/images.json - Images per channel
 *   - data/latest/discord/:channelId/images.json - Latest images per channel
 * - Activity and contributors:
 *   - data/activitygrid.json - Activity grid for all time
 *   - data/:year/activitygrid.json - Activity grid for specific years
 *   - data/contributors.json - Top contributors across all time
 *   - data/generated/profiles/:username.json - Individual user profiles
 *   - data/:year/users.json - Contributors for specific year
 * - Financial data:
 *   - data/:year/:month/transactions.json - Aggregated transactions
 *   - data/:year/:month/counterparties.json - Transaction counterparties
 * - Events:
 *   - data/:year/:month/events.json - Consolidated calendar events
 *
 * This script also calls generate-transactions and generate-events to create
 * all derived data files in one step.
 *
 * Usage:
 *   tsx scripts/generate-data-files.ts
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  readDiscordMessages,
  getAllPhotos,
  getAvailableYears,
  getAvailableMonths,
} from "../src/lib/reports";
import { type CachedMessage } from "../src/lib/discord-cache";
import { getGuildMembers, getGuildRoles, isDiscordConfigured } from "../src/lib/discord";
import { getProxiedDiscordImage } from "../src/lib/image-proxy";
import { getAccountAddressFromDiscordUserId } from "../src/lib/citizenwallet";
import { parseTokenValue } from "../src/lib/etherscan";
import {
  getCachedWalletAddress,
  setCachedWalletAddress,
  setBatchCachedWalletAddresses,
  getWalletCacheStats,
} from "../src/lib/wallet-address-cache";
import settings from "../src/settings/settings.json";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CHT_CONFIG = settings.contributionToken;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface ActivityGridData {
  years: Array<{
    year: string;
    months: Array<{
      month: string;
      contributorCount: number;
      photoCount: number;
    }>;
  }>;
}

/**
 * Generate images.json for a specific month
 * Generates both global and per-channel images
 */
function generateMonthImages(year: string, month: string): number {
  try {
    const messages = readDiscordMessages(year, month);
    const images = getAllPhotos(messages, { relative: true });

    // Sort by total reactions descending (for popularity)
    images.sort((a, b) => b.totalReactions - a.totalReactions);

    const outputPath = path.join(
      DATA_DIR,
      year,
      month,
      "discord",
      "images.json"
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      JSON.stringify({ year, month, count: images.length, images }, null, 2)
    );

    // Also generate per-channel images
    generateChannelImages(year, month);

    return images.length;
  } catch (error) {
    console.error(`  ❌ Error generating images for ${year}-${month}:`, error);
    return 0;
  }
}

/**
 * Generate per-channel images for a specific year/month
 */
function generateChannelImages(year: string, month: string): void {
  try {
    const allChannelIds = getAllChannelIds();

    for (const channelId of allChannelIds) {
      const messagesPath = path.join(
        DATA_DIR,
        year,
        month,
        "discord",
        channelId,
        "messages.json"
      );

      if (!fs.existsSync(messagesPath)) continue;

      const content = fs.readFileSync(messagesPath, "utf-8");
      const data = JSON.parse(content) as { messages: any[] };

      if (!data.messages || data.messages.length === 0) continue;

      const channelImages: any[] = [];

      // Extract images from messages
      for (const msg of data.messages) {
        const imageAttachments =
          msg.attachments?.filter(
            (att: any) =>
              att.content_type?.startsWith("image/") ||
              att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          ) || [];

        if (imageAttachments.length === 0) continue;

        // Process ALL image attachments, not just the first one
        for (const attachment of imageAttachments) {
          // Remove query parameters before getting extension
          const urlWithoutQuery = (attachment.url || "").split("?")[0];
          const ext = path.extname(urlWithoutQuery) || ".jpg";
          const filePath = `/data/${year}/${month}/discord/images/${attachment.id}${ext}`;

          // Generate proxy URL with all required metadata (relative for static files)
          const proxyUrl = getProxiedDiscordImage(
            channelId,
            msg.id,
            attachment.id,
            msg.timestamp,
            undefined,
            { relative: true }
          );

          channelImages.push({
            id: attachment.id,
            messageId: msg.id,
            channelId: channelId,
            timestamp: msg.timestamp,
            url: proxyUrl,
            proxyUrl: proxyUrl,
            filePath,
            author: {
              id: msg.author.id,
              username: msg.author.username,
              displayName: msg.author.global_name || msg.author.username,
              avatar: msg.author.avatar,
            },
            message: msg.content,
          });
        }
      }

      if (channelImages.length > 0) {
        // Sort by timestamp (newest first)
        channelImages.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Create channel-specific images file
        const channelDir = path.join(
          DATA_DIR,
          year,
          month,
          "discord",
          channelId
        );
        fs.mkdirSync(channelDir, { recursive: true });

        const outputPath = path.join(channelDir, "images.json");
        fs.writeFileSync(
          outputPath,
          JSON.stringify(
            {
              channelId,
              source: `${year}-${month}`,
              count: channelImages.length,
              images: channelImages,
            },
            null,
            2
          )
        );
      }
    }
  } catch (error) {
    console.error(
      `  ⚠️  Error generating channel images for ${year}-${month}:`,
      error
    );
  }
}

/**
 * Generate images for "latest" (no month subfolder)
 */
function generateLatestImages(): number {
  try {
    const allChannelIds = getAllChannelIds();
    const allImages: any[] = [];
    let totalChannels = 0;

    console.log(`  Processing latest...`);

    for (const channelId of allChannelIds) {
      const messagesPath = path.join(
        DATA_DIR,
        "latest",
        "discord",
        channelId,
        "messages.json"
      );

      if (!fs.existsSync(messagesPath)) continue;

      const content = fs.readFileSync(messagesPath, "utf-8");
      const data = JSON.parse(content) as { messages: any[] };

      if (!data.messages || data.messages.length === 0) continue;

      const channelImages: any[] = [];

      // Extract images from messages
      for (const msg of data.messages) {
        const imageAttachments =
          msg.attachments?.filter(
            (att: any) =>
              att.content_type?.startsWith("image/") ||
              att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          ) || [];

        if (imageAttachments.length === 0) continue;

        // Process ALL image attachments, not just the first one
        for (const attachment of imageAttachments) {
          // Remove query parameters before getting extension
          const urlWithoutQuery = (attachment.url || "").split("?")[0];
          const ext = path.extname(urlWithoutQuery) || ".jpg";

          // Use message timestamp to construct dated path
          const msgDate = new Date(msg.timestamp);
          const year = msgDate.getFullYear();
          const month = String(msgDate.getMonth() + 1).padStart(2, "0");
          const filePath = `/data/${year}/${month}/discord/images/${attachment.id}${ext}`;

          // Generate proxy URL with all required metadata (relative for static files)
          const proxyUrl = getProxiedDiscordImage(
            channelId,
            msg.id,
            attachment.id,
            msg.timestamp,
            undefined,
            { relative: true }
          );

          const imageData = {
            id: attachment.id,
            messageId: msg.id,
            channelId: channelId,
            timestamp: msg.timestamp,
            url: proxyUrl,
            proxyUrl: proxyUrl,
            filePath,
            author: {
              id: msg.author.id,
              username: msg.author.username,
              displayName: msg.author.global_name || msg.author.username,
              avatar: msg.author.avatar,
            },
            message: msg.content,
            totalReactions: 0, // Latest doesn't have reaction counts yet
          };

          channelImages.push(imageData);
          allImages.push(imageData);
        }
      }

      if (channelImages.length > 0) {
        // Sort by timestamp (newest first)
        channelImages.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Create channel-specific images file
        const channelDir = path.join(DATA_DIR, "latest", "discord", channelId);
        fs.mkdirSync(channelDir, { recursive: true });

        const outputPath = path.join(channelDir, "images.json");
        fs.writeFileSync(
          outputPath,
          JSON.stringify(
            {
              channelId,
              source: "latest",
              count: channelImages.length,
              images: channelImages,
            },
            null,
            2
          )
        );

        totalChannels++;
      }
    }

    // Generate global latest images.json
    if (allImages.length > 0) {
      allImages.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const outputPath = path.join(
        DATA_DIR,
        "latest",
        "discord",
        "images.json"
      );
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(
        outputPath,
        JSON.stringify(
          {
            source: "latest",
            count: allImages.length,
            images: allImages,
          },
          null,
          2
        )
      );

      console.log(
        `    ✓ latest: ${allImages.length} image(s) from ${totalChannels} channel(s)`
      );
    }

    return allImages.length;
  } catch (error) {
    console.error(`  ❌ Error generating latest images:`, error);
    return 0;
  }
}

/**
 * Get all channel IDs from settings.json
 */
function getAllChannelIds(): string[] {
  const channelIds = new Set<string>();
  const channels = settings.discord.channels;

  // Add top-level channels
  if (channels.general) channelIds.add(channels.general);
  if (channels.introductions) channelIds.add(channels.introductions);
  if (channels.requests) channelIds.add(channels.requests);
  if (channels.contributions) channelIds.add(channels.contributions);

  // Add room channels
  if (channels.rooms) {
    Object.values(channels.rooms).forEach((id) => channelIds.add(id));
  }

  // Add activity channels
  if (channels.activities) {
    Object.values(channels.activities).forEach((id) => channelIds.add(id));
  }

  return Array.from(channelIds);
}

/**
 * Generate activity grid data for all time (excluding "latest")
 */
function generateActivityGrid(): ActivityGridData {
  const years = getAvailableYears()
    .filter((y) => /^\d{4}$/.test(y))
    .sort();
  const gridData: ActivityGridData = { years: [] };

  for (const year of years) {
    const months = getAvailableMonths(year).sort();
    const yearData = {
      year,
      months: [] as Array<{
        month: string;
        contributorCount: number;
        photoCount: number;
      }>,
    };

    for (const month of months) {
      try {
        const messages = readDiscordMessages(year, month);
        const photos = getAllPhotos(messages);

        // Count unique contributors from Discord messages
        // Contributors are: message authors + mentioned users
        const contributorIds = new Set<string>();
        for (const message of messages) {
          // Add message author
          if (message.author?.id) {
            contributorIds.add(message.author.id);
          }
          // Add mentioned users
          if (message.mentions && Array.isArray(message.mentions)) {
            for (const mention of message.mentions) {
              if (mention.id) {
                contributorIds.add(mention.id);
              }
            }
          }
        }
        const contributorCount = contributorIds.size;

        yearData.months.push({
          month,
          contributorCount,
          photoCount: photos.length,
        });
      } catch (error) {
        console.error(
          `  ⚠️  Error processing ${year}-${month} for activity grid:`,
          error
        );
      }
    }

    gridData.years.push(yearData);
  }

  // Save global activity grid
  const outputPath = path.join(DATA_DIR, "activitygrid.json");
  fs.writeFileSync(outputPath, JSON.stringify(gridData, null, 2));
  console.log(`  ✓ Generated global activity grid`);

  return gridData;
}

/**
 * Generate year-specific activity grid
 */
function generateYearActivityGrid(year: string, gridData: ActivityGridData) {
  const yearData = gridData.years.find((y) => y.year === year);
  if (!yearData) {
    console.error(`  ⚠️  No data found for year ${year}`);
    return;
  }

  const outputPath = path.join(DATA_DIR, year, "activitygrid.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ year, months: yearData.months }, null, 2)
  );
}

/**
 * Generate monthly contributors.json for a specific month
 * Includes profile data, token data, and Discord activity metrics
 */
async function generateMonthContributors(
  year: string,
  month: string
): Promise<number> {
  try {
    const contributorsFile = path.join(
      DATA_DIR,
      year,
      month,
      "contributors.json"
    );

    // Get all Discord messages for this month
    const discordDir = path.join(DATA_DIR, year, month, "discord");
    if (!fs.existsSync(discordDir)) {
      return 0;
    }

    // Collect all messages from all channels
    const allMessages: CachedMessage[] = [];
    const messageCountByUser = new Map<string, number>();
    const mentionCountByUser = new Map<string, number>();
    const contributorProfiles = new Map<
      string,
      {
        id: string;
        username: string;
        displayName: string;
        avatar: string | null;
        description: string | null;
      }
    >();

    // Read all channel messages
    const entries = fs.readdirSync(discordDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const messagesPath = path.join(discordDir, entry.name, "messages.json");
      if (!fs.existsSync(messagesPath)) continue;

      try {
        const content = fs.readFileSync(messagesPath, "utf-8");
        const data = JSON.parse(content) as { messages: CachedMessage[] };

        for (const message of data.messages || []) {
          allMessages.push(message);

          // Count messages by author
          if (message.author && message.author.id) {
            const authorId = message.author.id;
            messageCountByUser.set(
              authorId,
              (messageCountByUser.get(authorId) || 0) + 1
            );

            // Store profile if not already stored
            if (!contributorProfiles.has(authorId)) {
              contributorProfiles.set(authorId, {
                id: authorId,
                username: message.author.username || authorId,
                displayName:
                  message.author.global_name || message.author.username || authorId,
                avatar: message.author.avatar || null,
                description: null,
              });
            }
          }

          // Count mentions
          if (message.mentions && Array.isArray(message.mentions)) {
            for (const mention of message.mentions) {
              if (mention && mention.id) {
                mentionCountByUser.set(
                  mention.id,
                  (mentionCountByUser.get(mention.id) || 0) + 1
                );

                // Store profile if not already stored
                if (!contributorProfiles.has(mention.id)) {
                  contributorProfiles.set(mention.id, {
                    id: mention.id,
                    username: mention.username || mention.id,
                    displayName: mention.global_name || mention.username || mention.id,
                    avatar: mention.avatar || null,
                    description: null,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`  ⚠️  Error reading ${entry.name}/messages.json:`, error);
      }
    }

    // Get descriptions from introductions channel
    const introductionsChannelId = settings.discord.channels.introductions;
    const introsPath = path.join(
      discordDir,
      introductionsChannelId,
      "messages.json"
    );
    if (fs.existsSync(introsPath)) {
      try {
        const content = fs.readFileSync(introsPath, "utf-8");
        const data = JSON.parse(content) as { messages: CachedMessage[] };

        for (const message of data.messages || []) {
          if (
            message.author &&
            message.author.id &&
            contributorProfiles.has(message.author.id) &&
            message.content &&
            message.content.length > 20
          ) {
            const profile = contributorProfiles.get(message.author.id);
            if (profile && !profile.description) {
              profile.description = message.content;
            }
          }
        }
      } catch (error) {
        console.error(`  ⚠️  Error reading introductions:`, error);
      }
    }

    // Fetch guild roles and members to get role information
    const guildId = settings.discord.guildId;
    const roleMap = new Map<string, string>(); // roleId -> roleName
    const memberRolesMap = new Map<string, string[]>(); // userId -> roleNames[]

    if (isDiscordConfigured()) {
      try {
        // Fetch all guild roles
        const guildRoles = await getGuildRoles(guildId);
        for (const role of guildRoles) {
          roleMap.set(role.id, role.name);
        }
        console.log(`  Fetched ${guildRoles.length} guild roles`);

        // Fetch guild members to get role assignments
        const guildMembers = await getGuildMembers(guildId, 1000);
        for (const member of guildMembers) {
          if (member.user && member.user.id && contributorProfiles.has(member.user.id)) {
            const roleNames = (member.roles || [])
              .map((roleId: string) => roleMap.get(roleId))
              .filter((name: string | undefined): name is string => name !== undefined && name !== "@everyone");

            if (roleNames.length > 0) {
              memberRolesMap.set(member.user.id, roleNames);
            }
          }
        }
        console.log(`  Mapped roles for ${memberRolesMap.size} contributors`);
      } catch (error) {
        console.warn(`  ⚠️  Could not fetch guild roles/members:`, error);
      }
    }

    // Get CHT token transactions for this month
    interface CHTTransaction {
      from: string;
      to: string;
      value: string;
      timeStamp: string;
    }

    const chtPath = path.join(DATA_DIR, year, month, "finance", "celo", "CHT.json");
    let transactions: CHTTransaction[] = [];

    if (fs.existsSync(chtPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(chtPath, "utf-8"));
        transactions = data.transactions || [];
      } catch (error) {
        console.error(`  ⚠️  Error reading CHT transactions:`, error);
      }
    }

    // Build final contributors list with all data
    const contributors: Array<{
      id: string;
      profile: {
        name: string;
        username: string;
        description: string | null;
        avatar_url: string | null;
        roles: string[];
      };
      tokens: {
        in: number;
        out: number;
      };
      discord: {
        messages: number;
        mentions: number;
      };
      address: string | null;
    }> = [];

    let processedCount = 0;
    const totalUsers = contributorProfiles.size;

    for (const [userId, profile] of contributorProfiles) {
      processedCount++;

      // Show progress every 10 users
      if (processedCount % 10 === 0 || processedCount === totalUsers) {
        process.stdout.write(
          `\r    Processing user ${processedCount}/${totalUsers}...`
        );
      }

      try {
        // Get wallet address (check cache first)
        let walletAddress = getCachedWalletAddress(userId);

        if (walletAddress === undefined) {
          // Not in cache, fetch from blockchain
          walletAddress = await getAccountAddressFromDiscordUserId(userId);
          setCachedWalletAddress(userId, walletAddress);
        }

        // Calculate token stats
        let tokensIn = 0;
        let tokensOut = 0;

        if (walletAddress && walletAddress !== ZERO_ADDRESS) {
          const normalizedAddress = walletAddress.toLowerCase();

          for (const tx of transactions) {
            const from = tx.from.toLowerCase();
            const to = tx.to.toLowerCase();
            const value = parseTokenValue(tx.value, CHT_CONFIG.decimals);

            // Tokens received (minted or incoming transfer)
            if (to === normalizedAddress) {
              tokensIn += value;
            }

            // Tokens spent (burnt or outgoing transfer)
            if (from === normalizedAddress && from !== ZERO_ADDRESS.toLowerCase()) {
              tokensOut += value;
            }
          }
        }

        contributors.push({
          id: userId,
          profile: {
            name: profile.displayName,
            username: profile.username,
            description: profile.description,
            avatar_url: profile.avatar
              ? `https://cdn.discordapp.com/avatars/${userId}/${profile.avatar}.png`
              : null,
            roles: memberRolesMap.get(userId) || [],
          },
          tokens: {
            in: tokensIn,
            out: tokensOut,
          },
          discord: {
            messages: messageCountByUser.get(userId) || 0,
            mentions: mentionCountByUser.get(userId) || 0,
          },
          address: walletAddress &&
            walletAddress !== ZERO_ADDRESS
            ? walletAddress
            : null,
        });

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`\n  ⚠️  Error processing user ${userId}:`, error);
        // Add user with basic data
        contributors.push({
          id: userId,
          profile: {
            name: profile.displayName,
            username: profile.username,
            description: profile.description,
            avatar_url: profile.avatar
              ? `https://cdn.discordapp.com/avatars/${userId}/${profile.avatar}.png`
              : null,
            roles: memberRolesMap.get(userId) || [],
          },
          tokens: {
            in: 0,
            out: 0,
          },
          discord: {
            messages: messageCountByUser.get(userId) || 0,
            mentions: mentionCountByUser.get(userId) || 0,
          },
          address: null,
        });
      }
    }

    process.stdout.write("\n"); // Clear progress line

    // Sort by tokens received descending
    contributors.sort((a, b) => b.tokens.in - a.tokens.in);

    // Calculate summary stats
    const contributorsWithTokens = contributors.filter(
      (c) => c.tokens.in > 0 || c.tokens.out > 0
    );
    const contributorsWithAddress = contributors.filter((c) => c.address !== null);
    const totalTokensIn = contributors.reduce((sum, c) => sum + c.tokens.in, 0);
    const totalTokensOut = contributors.reduce((sum, c) => sum + c.tokens.out, 0);
    const totalMessages = contributors.reduce(
      (sum, c) => sum + c.discord.messages,
      0
    );

    // Write to file
    const outputData = {
      year,
      month,
      summary: {
        totalContributors: contributors.length,
        contributorsWithAddress: contributorsWithAddress.length,
        contributorsWithTokens: contributorsWithTokens.length,
        totalTokensIn,
        totalTokensOut,
        totalMessages,
      },
      contributors,
      generatedAt: new Date().toISOString(),
    };

    fs.mkdirSync(path.dirname(contributorsFile), { recursive: true });
    fs.writeFileSync(contributorsFile, JSON.stringify(outputData, null, 2));

    return contributors.length;
  } catch (error) {
    console.error(
      `  ❌ Error generating contributors for ${year}-${month}:`,
      error
    );
    return 0;
  }
}

/**
 * Generate contributors.json from cached messages
 */
async function generateContributors(): Promise<number> {
  try {
    const contributionsChannelId = settings.discord.channels.contributions;
    const guildId = settings.discord.guildId;

    // Find the most recent 3 months that have contribution data
    const availableMonths: Array<{
      year: string;
      month: string;
      timestamp: number;
    }> = [];

    // Scan all available years and months
    const years = getAvailableYears()
      .filter((y) => /^\d{4}$/.test(y))
      .sort()
      .reverse();
    for (const year of years) {
      const months = getAvailableMonths(year).sort().reverse();
      for (const month of months) {
        const messagesPath = path.join(
          DATA_DIR,
          year,
          month,
          "discord",
          contributionsChannelId,
          "messages.json"
        );

        if (fs.existsSync(messagesPath)) {
          // Use the last day of the month as the timestamp for sorting
          const monthDate = new Date(
            Number.parseInt(year),
            Number.parseInt(month) - 1,
            1
          );
          availableMonths.push({ year, month, timestamp: monthDate.getTime() });
        }
      }
    }

    // Sort by timestamp descending and take the most recent 3 months
    availableMonths.sort((a, b) => b.timestamp - a.timestamp);
    const recentMonths = availableMonths.slice(0, 3);

    console.log(
      `  ℹ Using ${recentMonths.length} most recent months: ${recentMonths.map((m) => `${m.year}-${m.month}`).join(", ")}`
    );

    // Calculate 3 months ago from the most recent month
    const now =
      recentMonths.length > 0
        ? new Date(recentMonths[0].timestamp)
        : new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    // Collect messages from recent months
    const contributionMessages: CachedMessage[] = [];
    for (const { year, month } of recentMonths) {
      const messagesPath = path.join(
        DATA_DIR,
        year,
        month,
        "discord",
        contributionsChannelId,
        "messages.json"
      );

      try {
        const content = fs.readFileSync(messagesPath, "utf-8");
        const data = JSON.parse(content) as { messages: CachedMessage[] };
        // Filter messages to only include those within the past 3 months
        const filteredMessages = data.messages.filter((msg) => {
          const msgDate = new Date(msg.timestamp);
          return msgDate >= threeMonthsAgo;
        });
        contributionMessages.push(...filteredMessages);
      } catch (error) {
        console.warn(
          `  ⚠️  Error reading ${year}-${month} contributions:`,
          error
        );
      }
    }

    console.log(
      `  ℹ Processing ${contributionMessages.length} messages from past 3 months`
    );

    // Process messages to identify contributors
    const contributorMap = new Map();
    const contributionCounts = new Map();

    const isDeletedUser = (author: any) =>
      author.username === "Deleted User" ||
      author.username.startsWith("deleted_user_");

    // Process contribution messages
    for (const message of contributionMessages) {
      if (
        isDeletedUser(message.author) ||
        message.author.username.toLowerCase().includes("bot")
      ) {
        continue;
      }

      const authorId = message.author.id;
      contributionCounts.set(
        authorId,
        (contributionCounts.get(authorId) || 0) + 1
      );

      if (!contributorMap.has(authorId)) {
        contributorMap.set(authorId, {
          id: authorId,
          username: message.author.username,
          displayName: message.author.global_name || message.author.username,
          avatar: message.author.avatar
            ? `https://cdn.discordapp.com/avatars/${authorId}/${message.author.avatar}.png`
            : null,
          contributionCount: 0,
          joinedAt: message.timestamp,
        });
      } else {
        const existing = contributorMap.get(authorId);
        // Update joinedAt to earliest message timestamp (even if previously null from mention)
        if (
          !existing.joinedAt ||
          new Date(message.timestamp) < new Date(existing.joinedAt)
        ) {
          existing.joinedAt = message.timestamp;
        }
      }

      // Process mentions - add mentioned users as contributors
      for (const mention of message.mentions || []) {
        if (isDeletedUser({ username: mention.username })) continue;
        if (mention.username.toLowerCase().includes("bot")) continue;

        if (!contributorMap.has(mention.id)) {
          contributorMap.set(mention.id, {
            id: mention.id,
            username: mention.username,
            displayName: mention.global_name || mention.username,
            avatar: mention.avatar
              ? `https://cdn.discordapp.com/avatars/${mention.id}/${mention.avatar}.png`
              : null,
            contributionCount: 0,
            joinedAt: null,
          });
        }
      }
    }

    // Update contribution counts
    for (const [id, count] of contributionCounts) {
      const contributor = contributorMap.get(id);
      if (contributor) {
        contributor.contributionCount = count;
      }
    }

    // Also check introduction messages from all time to get accurate joinedAt
    const introductionsChannelId = settings.discord.channels.introductions;
    const allYears = getAvailableYears().filter((y) => /^\d{4}$/.test(y));

    for (const year of allYears) {
      const months = getAvailableMonths(year);
      for (const month of months) {
        const introsPath = path.join(
          DATA_DIR,
          year,
          month,
          "discord",
          introductionsChannelId,
          "messages.json"
        );

        if (!fs.existsSync(introsPath)) continue;

        try {
          const content = fs.readFileSync(introsPath, "utf-8");
          const data = JSON.parse(content) as { messages: CachedMessage[] };

          for (const message of data.messages || []) {
            if (isDeletedUser(message.author)) continue;
            if (message.author.username.toLowerCase().includes("bot")) continue;

            const authorId = message.author.id;
            const existing = contributorMap.get(authorId);

            if (existing) {
              // Update joinedAt if this introduction is earlier
              if (
                !existing.joinedAt ||
                new Date(message.timestamp) < new Date(existing.joinedAt)
              ) {
                existing.joinedAt = message.timestamp;
              }
            }
          }
        } catch (error) {
          // Silently skip errors reading introduction files
        }
      }
    }

    // Fetch guild members to get guild-specific profiles
    let guildMemberMap: Map<string, any> = new Map();
    let totalMembers = 0;
    if (isDiscordConfigured()) {
      try {
        const guildMembers = await getGuildMembers(guildId, 1000);
        totalMembers = guildMembers.length;
        for (const member of guildMembers) {
          guildMemberMap.set(member.user.id, {
            nick: member.nick, // Guild-specific nickname
            guildAvatar: member.avatar // Guild-specific avatar hash
              ? `https://cdn.discordapp.com/guilds/${guildId}/users/${member.user.id}/avatars/${member.avatar}.png`
              : null,
          });
        }
        console.log(`  ℹ Fetched ${guildMembers.length} guild members`);
      } catch (error) {
        console.warn(`  ⚠ Could not fetch guild members:`, error);
      }
    }

    // Update contributors with guild-specific profiles
    for (const contributor of contributorMap.values()) {
      const guildProfile = guildMemberMap.get(contributor.id);
      if (guildProfile) {
        // Use guild nickname if available, otherwise keep displayName
        if (guildProfile.nick) {
          contributor.displayName = guildProfile.nick;
        }
        // Use guild avatar if available, otherwise keep user avatar
        if (guildProfile.guildAvatar) {
          contributor.avatar = guildProfile.guildAvatar;
        }
      }
    }

    // Get top 24 contributors by contribution count
    const contributors = Array.from(contributorMap.values())
      .sort((a: any, b: any) => b.contributionCount - a.contributionCount)
      .slice(0, 24);

    // Fetch wallet addresses for contributors (with caching)
    console.log(`  ℹ Fetching wallet addresses for ${contributors.length} contributors...`);
    let cachedCount = 0;
    let fetchedCount = 0;
    const addressPromises = contributors.map(async (contributor: any) => {
      // Check cache first
      const cachedAddress = getCachedWalletAddress(contributor.id);

      if (cachedAddress !== undefined) {
        // Found in cache
        cachedCount++;
        contributor.walletAddress = cachedAddress;
        return;
      }

      // Not in cache, fetch from blockchain
      try {
        const address = await getAccountAddressFromDiscordUserId(contributor.id);
        contributor.walletAddress = address;
        setCachedWalletAddress(contributor.id, address);
        fetchedCount++;
      } catch (error) {
        console.warn(
          `  ⚠️  Error fetching wallet for ${contributor.username}:`,
          error
        );
        contributor.walletAddress = null;
        setCachedWalletAddress(contributor.id, null);
      }
    });

    await Promise.all(addressPromises);
    console.log(
      `  ✓ Wallet addresses: ${cachedCount} from cache, ${fetchedCount} fetched`
    );

    // Total unique contributors (authors + mentioned)
    const activeCommoners = contributorMap.size;

    const contributorsData = {
      contributors,
      totalMembers,
      activeCommoners,
      timestamp: Date.now(),
      isMockData: false,
    };

    const outputPath = path.join(DATA_DIR, "contributors.json");
    fs.writeFileSync(outputPath, JSON.stringify(contributorsData, null, 2));

    console.log(
      `  ✓ Generated contributors.json (${contributors.length} contributors, ${activeCommoners} active commoners)`
    );
    return contributors.length;
  } catch (error) {
    console.error(`  ❌ Error generating contributors:`, error);
    return 0;
  }
}

/**
 * Main function
 */
/**
 * Generate individual profile JSON files for each contributor
 */
async function generateUserProfiles() {
  // Collect contributors from all years
  const contributorsMap = new Map<string, any>();

  // First, add contributors from recent 3 months (contributors.json)
  const contributorsPath = path.join(DATA_DIR, "contributors.json");
  if (fs.existsSync(contributorsPath)) {
    const contributorsData = JSON.parse(
      fs.readFileSync(contributorsPath, "utf-8")
    );
    for (const contributor of contributorsData.contributors || []) {
      contributorsMap.set(contributor.id, contributor);
    }
  }

  // Then, add contributors from all yearly files
  const years = getAvailableYears().filter((y) => /^\d{4}$/.test(y));
  for (const year of years) {
    const yearlyPath = path.join(DATA_DIR, year, "contributors.json");
    if (fs.existsSync(yearlyPath)) {
      try {
        const yearlyData = JSON.parse(fs.readFileSync(yearlyPath, "utf-8"));
        for (const contributor of yearlyData.contributors || []) {
          if (!contributorsMap.has(contributor.id)) {
            contributorsMap.set(contributor.id, contributor);
          }
        }
      } catch (error) {
        console.error(`  ⚠️  Error reading ${year}/contributors.json:`, error);
      }
    }
  }

  if (contributorsMap.size === 0) {
    console.warn("  ⚠ No contributors found, skipping profile generation");
    return 0;
  }

  const contributors = Array.from(contributorsMap.values());

  const introductionsChannelId = settings.discord.channels.introductions;
  const contributionsChannelId = settings.discord.channels.contributions;

  const profilesDir = path.join(DATA_DIR, "generated", "profiles");
  fs.mkdirSync(profilesDir, { recursive: true });

  let profileCount = 0;

  for (const contributor of contributors) {
    try {
      const profile: any = {
        id: contributor.id,
        username: contributor.username,
        displayName: contributor.displayName,
        avatar: contributor.avatar,
        contributionCount: contributor.contributionCount,
        joinedAt: contributor.joinedAt,
        introductions: [],
        contributions: [],
        imagesByMonth: {},
      };

      // Determine the start date (when they joined) - used for contributions/images only
      const joinedDate = contributor.joinedAt
        ? new Date(contributor.joinedAt)
        : null;

      // Collect all messages from all months
      const years = getAvailableYears();

      for (const year of years) {
        const months = getAvailableMonths(year);

        for (const month of months) {
          const yearMonthKey = `${year}-${month}`;
          const monthDate = new Date(`${year}-${month}-01`);

          // Check if this month is before joinedAt (for contributions/images filtering)
          const isBeforeJoined = joinedDate && monthDate < new Date(joinedDate.getFullYear(), joinedDate.getMonth(), 1);

          // Process introductions (always, regardless of joinedAt - someone might introduce themselves before contributing)
          const introsPath = path.join(
            DATA_DIR,
            year,
            month,
            "discord",
            introductionsChannelId,
            "messages.json"
          );
          if (fs.existsSync(introsPath)) {
            const introsData = JSON.parse(fs.readFileSync(introsPath, "utf-8"));
            const userIntros = introsData.messages.filter(
              (msg: any) =>
                msg.author?.id === contributor.id &&
                msg.content &&
                msg.content.length > 10
            );

            for (const intro of userIntros) {
              profile.introductions.push({
                content: intro.content,
                timestamp: intro.timestamp,
                attachments: intro.attachments || [],
                messageId: intro.id,
                channelId: introductionsChannelId,
              });
            }
          }

          // Skip contributions and images for months before they joined
          if (isBeforeJoined) {
            continue;
          }

          // Process contributions
          const contribsPath = path.join(
            DATA_DIR,
            year,
            month,
            "discord",
            contributionsChannelId,
            "messages.json"
          );
          if (fs.existsSync(contribsPath)) {
            const contribsData = JSON.parse(
              fs.readFileSync(contribsPath, "utf-8")
            );
            const userContribs = contribsData.messages.filter(
              (msg: any) =>
                msg.author?.id === contributor.id ||
                msg.mentions?.some((m: any) => m.id === contributor.id)
            );

            for (const contrib of userContribs) {
              profile.contributions.push({
                content: contrib.content,
                timestamp: contrib.timestamp,
                attachments: contrib.attachments || [],
                reactions: contrib.reactions || [],
                mentions: contrib.mentions || [],
                author: contrib.author,
                messageId: contrib.id,
                channelId: contributionsChannelId,
              });
            }
          }

          // Process images
          const imagesPath = path.join(
            DATA_DIR,
            year,
            month,
            "discord",
            "images.json"
          );
          if (fs.existsSync(imagesPath)) {
            const imagesData = JSON.parse(fs.readFileSync(imagesPath, "utf-8"));
            const userImages = imagesData.images.filter(
              (img: any) => img.author?.id === contributor.id
            );

            if (userImages.length > 0) {
              profile.imagesByMonth[yearMonthKey] = userImages.map(
                (img: any) => ({
                  url: img.url,
                  proxyUrl: img.proxyUrl,
                  id: img.id,
                  author: img.author,
                  timestamp: img.timestamp,
                  reactions: img.reactions || [],
                  totalReactions: img.totalReactions || 0,
                  message: img.message || "",
                  messageId: img.messageId,
                  channelId: img.channelId,
                })
              );
            }
          }
        }
      }

      // Sort by timestamp
      profile.introductions.sort(
        (a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      profile.contributions.sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Write profile file
      const profilePath = path.join(
        profilesDir,
        `${contributor.username}.json`
      );
      fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
      profileCount++;
    } catch (error) {
      console.error(
        `  ⚠ Error generating profile for ${contributor.username}:`,
        error
      );
    }
  }

  console.log(`  ✓ Generated ${profileCount} user profile(s)`);
  return profileCount;
}

/**
 * Generate yearly contributors.json file with contributors for that year
 * Aggregates from monthly contributors.json files
 */
async function generateYearlyUsers(year: string): Promise<void> {
  console.log(`\n📄 Generating contributors.json for ${year}...`);

  const contributorMap = new Map<
    string,
    {
      id: string;
      profile: {
        name: string;
        username: string;
        description: string | null;
        avatar_url: string | null;
        roles: string[];
      };
      tokens: { in: number; out: number };
      discord: { messages: number; mentions: number };
      address: string | null;
      contributionCount: number;
    }
  >();

  // Get all months for this year
  const months = getAvailableMonths(year);

  // Aggregate from monthly contributors.json files
  for (const month of months) {
    const contributorsPath = path.join(
      DATA_DIR,
      year,
      month,
      "contributors.json"
    );

    if (!fs.existsSync(contributorsPath)) continue;

    try {
      const content = fs.readFileSync(contributorsPath, "utf-8");
      const data = JSON.parse(content) as {
        contributors?: Array<{
          id: string;
          profile: {
            name: string;
            username: string;
            description: string | null;
            avatar_url: string | null;
            roles: string[];
          };
          tokens: { in: number; out: number };
          discord: { messages: number; mentions: number };
          address: string | null;
        }>;
      };

      for (const contributor of data.contributors || []) {
        const userId = contributor.id;

        if (!contributorMap.has(userId)) {
          contributorMap.set(userId, {
            id: userId,
            profile: contributor.profile,
            tokens: { ...contributor.tokens },
            discord: { ...contributor.discord },
            address: contributor.address,
            contributionCount: 0,
          });
        } else {
          // Aggregate tokens and discord activity
          const existing = contributorMap.get(userId)!;
          existing.tokens.in += contributor.tokens.in;
          existing.tokens.out += contributor.tokens.out;
          existing.discord.messages += contributor.discord.messages;
          existing.discord.mentions += contributor.discord.mentions;

          // Update profile with latest data (including roles)
          existing.profile = contributor.profile;

          // Update address if we found one
          if (contributor.address && !existing.address) {
            existing.address = contributor.address;
          }
        }
      }
    } catch (error) {
      console.error(
        `  ⚠️  Error processing ${year}-${month}/contributors.json:`,
        error
      );
    }
  }

  // Count unique contribution days from Discord contributions channel
  const contributionDaysMap = new Map<string, Set<string>>();
  const contributionsChannelId = "1297965144579637248";

  for (const month of months) {
    const contributionsPath = path.join(
      DATA_DIR,
      year,
      month,
      "discord",
      contributionsChannelId,
      "messages.json"
    );

    if (!fs.existsSync(contributionsPath)) continue;

    try {
      const content = fs.readFileSync(contributionsPath, "utf-8");
      const data = JSON.parse(content) as {
        messages?: Array<{
          id: string;
          author: { id: string };
          timestamp: string;
          mentions?: Array<{ id: string }>;
        }>;
      };

      for (const message of data.messages || []) {
        const date = message.timestamp.split("T")[0]; // YYYY-MM-DD

        // Count author of the message
        const authorId = message.author.id;
        if (!contributionDaysMap.has(authorId)) {
          contributionDaysMap.set(authorId, new Set());
        }
        contributionDaysMap.get(authorId)!.add(date);

        // Count mentioned users
        for (const mention of message.mentions || []) {
          if (!contributionDaysMap.has(mention.id)) {
            contributionDaysMap.set(mention.id, new Set());
          }
          contributionDaysMap.get(mention.id)!.add(date);
        }
      }
    } catch (error) {
      console.error(
        `  ⚠️  Error processing ${year}-${month} contributions messages:`,
        error
      );
    }
  }

  // Update contribution counts
  for (const [id, days] of contributionDaysMap) {
    const contributor = contributorMap.get(id);
    if (contributor) {
      contributor.contributionCount = days.size;
    }
  }

  // Filter out users with no contributions and sort by tokens received
  const contributors = Array.from(contributorMap.values())
    .filter((c) => c.contributionCount > 0 || c.tokens.in > 0)
    .map(({ contributionCount, ...contributor }) => ({
      ...contributor,
      contributionDays: contributionCount,
    }))
    .sort((a, b) => b.tokens.in - a.tokens.in);

  const summary = {
    totalContributors: contributors.length,
    contributorsWithAddress: contributors.filter((c) => c.address).length,
    contributorsWithTokens: contributors.filter(
      (c) => c.tokens.in > 0 || c.tokens.out > 0
    ).length,
    totalTokensIn: contributors.reduce((sum, c) => sum + c.tokens.in, 0),
    totalTokensOut: contributors.reduce((sum, c) => sum + c.tokens.out, 0),
    totalMessages: contributors.reduce((sum, c) => sum + c.discord.messages, 0),
    totalContributionDays: contributors.reduce(
      (sum, c) => sum + c.contributionDays,
      0
    ),
  };

  const outputData = {
    year,
    summary,
    contributors,
    generatedAt: new Date().toISOString(),
  };

  const outputPath = path.join(DATA_DIR, year, "contributors.json");
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(
    `  ✓ Generated contributors.json with ${contributors.length} contributors`
  );
}

async function main() {
  console.log(
    "🚀 Generating derived data files from cached Discord messages..."
  );
  console.log(`📂 DATA_DIR: ${DATA_DIR}\n`);

  const years = getAvailableYears();
  if (years.length === 0) {
    console.log("⚠️  No data found. Run warmup-discord-cache.js first.");
    return;
  }

  console.log(
    `📋 Found ${years.length} year(s) with data: ${years.join(", ")}\n`
  );

  // Generate images.json for each month (excluding "latest")
  console.log("📸 Generating images.json files...");
  let totalImages = 0;
  let totalMonths = 0;

  for (const year of years) {
    // Skip "latest" - it will be handled separately
    if (year === "latest") continue;

    const months = getAvailableMonths(year);
    console.log(`  Processing ${year} (${months.length} month(s))...`);

    for (const month of months) {
      const imageCount = generateMonthImages(year, month);
      if (imageCount > 0) {
        console.log(`    ✓ ${year}-${month}: ${imageCount} image(s)`);
        totalImages += imageCount;
        totalMonths++;
      }
    }
  }

  // Generate latest images (no month subfolder)
  const latestDir = path.join(DATA_DIR, "latest");
  if (fs.existsSync(latestDir)) {
    const latestCount = generateLatestImages();
    totalImages += latestCount;
  }

  console.log(
    `  ✓ Generated ${totalMonths} monthly images.json file(s) with ${totalImages} total images\n`
  );

  // Generate monthly contributors.json files
  console.log("👥 Generating monthly contributors.json files...");
  let totalContributorsGenerated = 0;
  let totalMonthsWithContributors = 0;

  for (const year of years) {
    // Skip "latest"
    if (year === "latest") continue;

    const months = getAvailableMonths(year);
    console.log(`  Processing ${year} (${months.length} month(s))...`);

    for (const month of months) {
      const contributorCount = await generateMonthContributors(year, month);
      if (contributorCount > 0) {
        console.log(`    ✓ ${year}-${month}: ${contributorCount} contributor(s)`);
        totalContributorsGenerated += contributorCount;
        totalMonthsWithContributors++;
      }
    }
  }

  console.log(
    `  ✓ Generated contributors.json for ${totalMonthsWithContributors} month(s)\n`
  );

  // Generate activity grids (skip "latest" for activity grids)
  console.log("📊 Generating activity grids...");
  const gridData = generateActivityGrid();

  // Generate year-specific grids (only for numeric years)
  for (const year of years) {
    if (/^\d{4}$/.test(year)) {
      generateYearActivityGrid(year, gridData);
      console.log(`  ✓ Generated activity grid for ${year}`);
    }
  }

  // Generate contributors data
  console.log("\n👥 Generating contributors data...");
  await generateContributors();
  console.log();

  // Generate user profiles
  console.log("👤 Generating user profiles...");
  await generateUserProfiles();
  console.log();

  // Generate yearly contributors.json files (only for numeric years)
  console.log("📅 Generating yearly contributors.json files...");
  for (const year of years) {
    if (/^\d{4}$/.test(year)) {
      await generateYearlyUsers(year);
    }
  }
  console.log();

  // Generate transactions data
  console.log("💰 Generating transactions data...");
  try {
    execSync("tsx scripts/generate-transactions.ts", { stdio: "inherit" });
  } catch (error) {
    console.error("⚠️  Error generating transactions:", error);
  }
  console.log();

  // Generate events data
  console.log("📅 Generating events data...");
  try {
    execSync("tsx scripts/generate-events.ts", { stdio: "inherit" });
  } catch (error) {
    console.error("⚠️  Error generating events:", error);
  }
  console.log();

  console.log("\n" + "=".repeat(60));
  console.log("✅ All data generation completed successfully!");
  console.log("=".repeat(60));
}

// Run the script
main().catch((error) => {
  console.error("\n❌ Fatal error during data generation:", error);
  process.exit(1);
});
