/**
 * Warmup script for Discord message cache
 *
 * This script fetches historic messages for all configured Discord channels
 * and stores them in monthly cache files (data/discord/{channelId}/{year}/{month}.json).
 *
 * Features:
 * - Fetches messages for all channels specified in settings.json
 * - Organizes messages by year/month following the same pattern as financial transactions
 * - Skips already cached months (fetches only new messages)
 * - Handles Discord API rate limiting automatically
 *
 * Usage:
 *   node scripts/warmup-discord-cache.js
 *
 * Environment variables:
 *   DISCORD_BOT_TOKEN - Your Discord bot token (required)
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { toZonedTime } from "date-fns-tz";
import { getChannelMessages } from "../src/lib/discord.ts";
import {
  getAllCachedMessages,
  addMessagesToCache,
  getCachedMonths,
  getCacheStats,
} from "../src/lib/discord-cache.ts";
import settings from "../src/settings/settings.json" with { type: "json" };

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const TIMEZONE = process.env.TZ || "Europe/Brussels";

/**
 * Parse command line arguments for month filtering
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let startMonth = undefined;
  let endMonth = undefined;

  for (const arg of args) {
    if (arg.startsWith("--month=")) {
      const month = arg.split("=")[1];
      startMonth = month;
      endMonth = month;
    } else if (arg.startsWith("--start-month=")) {
      startMonth = arg.split("=")[1];
    } else if (arg.startsWith("--end-month=")) {
      endMonth = arg.split("=")[1];
    }
  }

  return { startMonth, endMonth };
}

/**
 * Check if a month key is within the specified date range
 */
function isMonthInRange(monthKey, startMonth, endMonth) {
  if (!startMonth && !endMonth) return true;
  if (startMonth && monthKey < startMonth) return false;
  if (endMonth && monthKey > endMonth) return false;
  return true;
}

/**
 * Get all channel IDs from settings.json
 */
function getAllChannelIds() {
  const channelIds = new Set();
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
 * Get channel name from settings (for logging)
 */
function getChannelName(channelId) {
  const channels = settings.discord.channels;

  // Check top-level channels
  for (const [name, id] of Object.entries(channels)) {
    if (id === channelId) return name;
  }

  // Check room channels
  if (channels.rooms) {
    for (const [name, id] of Object.entries(channels.rooms)) {
      if (id === channelId) return `rooms/${name}`;
    }
  }

  // Check activity channels
  if (channels.activities) {
    for (const [name, id] of Object.entries(channels.activities)) {
      if (id === channelId) return `activities/${name}`;
    }
  }

  return channelId;
}

/**
 * Download an image using its attachment ID as filename
 */
async function downloadImage(url, attachmentId, year, month) {
  try {
    // Skip downloading images in Vercel/serverless environments
    if (process.env.VERCEL_URL) {
      console.log(
        `  ⏭️  Skipping image download in Vercel environment: ${attachmentId}`
      );
      return true;
    }

    // Get file extension from URL path
    const urlObj = new URL(url);
    const urlPath = urlObj.pathname;
    const ext = path.extname(urlPath) || ".jpg";
    const filename = `${attachmentId}${ext}`;

    // Create images directory if it doesn't exist
    const imagesDir = path.join(DATA_DIR, year, month, "discord", "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const filepath = path.join(imagesDir, filename);

    // Only download if file doesn't exist
    if (fs.existsSync(filepath)) {
      return true;
    }

    // Fetch the image with full URL including query parameters (contains auth tokens)
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `  ⚠️  Failed to download image: ${response.status} ${url}`
      );
      return false;
    }

    // Get image data and save
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);

    console.log(
      `  💾 Downloaded image: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`
    );
    return true;
  } catch (error) {
    console.error(
      `  ⚠️  Error downloading image ${attachmentId}:`,
      error.message
    );
    return false;
  }
}

/**
 * Download images from attachments
 */
async function downloadAttachmentImages(attachments, year, month) {
  for (const att of attachments) {
    const isImage =
      att.content_type?.startsWith("image/") ||
      /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url);
    if (isImage) {
      await downloadImage(att.url, att.id, year, month);
    }
  }
}

/**
 * Re-fetch messages for a specific month to get fresh URLs and download images
 */
async function refetchAndDownloadImagesForMonth(
  channelId,
  monthKey,
  cachedMessages
) {
  console.log(`  📥 Re-fetching messages for ${monthKey} to get fresh URLs...`);

  const [year, month] = monthKey.split("-");

  // Get date range for this month
  const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  // Get oldest and newest message IDs for this month
  const oldestId = cachedMessages[cachedMessages.length - 1]?.id;
  const newestId = cachedMessages[0]?.id;

  if (!oldestId) return 0;

  let downloadedCount = 0;
  let fetchedMessages = [];

  try {
    // Fetch messages around the time range
    // Start from the newest message in the month and fetch backwards
    let hasMore = true;
    let beforeId = newestId;
    let attempts = 0;
    const maxAttempts = 10; // Limit to prevent infinite loops

    while (hasMore && attempts < maxAttempts) {
      attempts++;
      const options = { limit: 100 };
      if (beforeId) {
        options.before = beforeId;
      }

      const messages = await getChannelMessages(channelId, options);
      if (!messages || messages.length === 0) break;

      // Filter messages for this month
      const monthMessages = messages.filter((msg) => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= startDate && msgDate < endDate;
      });

      fetchedMessages.push(...monthMessages);

      // Download images from fresh URLs
      for (const msg of monthMessages) {
        if (msg.attachments && msg.attachments.length > 0) {
          await downloadAttachmentImages(msg.attachments, year, month);
          downloadedCount += msg.attachments.filter(
            (att) =>
              att.content_type?.startsWith("image/") ||
              /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url)
          ).length;
        }
      }

      // Check if we've reached the oldest message for this month
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.id === oldestId || new Date(lastMsg.timestamp) < startDate) {
        break;
      }

      beforeId = lastMsg.id;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (downloadedCount > 0) {
      console.log(`  ✓ Downloaded ${downloadedCount} image(s) for ${monthKey}`);
    }
  } catch (error) {
    console.error(
      `  ⚠️  Error re-fetching messages for ${monthKey}:`,
      error.message
    );
  }

  return downloadedCount;
}

/**
 * Check if images folder exists and has images for a given month
 */
function hasImagesForMonth(year, month) {
  const imagesDir = path.join(DATA_DIR, year, month, "discord", "images");
  if (!fs.existsSync(imagesDir)) return false;

  // Check if directory has any files
  const files = fs.readdirSync(imagesDir);
  return files.length > 0;
}

/**
 * Fetch all historic messages for a channel
 */
async function fetchChannelHistory(
  channelId,
  channelName,
  forceRewrite = false,
  startMonth = undefined,
  endMonth = undefined
) {
  console.log(
    `\n📥 Fetching messages for channel: ${channelName} (${channelId})`
  );
  if (startMonth || endMonth) {
    console.log(
      `  📅 Month filter: ${startMonth || "any"} to ${endMonth || "any"}`
    );
  }

  // Get existing cache stats (unless force rewrite)
  const existingMessages = forceRewrite ? [] : getAllCachedMessages(channelId);
  const cachedMonths = forceRewrite ? [] : getCachedMonths(channelId);

  if (forceRewrite) {
    console.log(`  ⚠️  Force rewrite mode - ignoring existing cache`);
  } else if (existingMessages.length > 0) {
    console.log(
      `  ℹ️  Found ${existingMessages.length} cached messages across ${cachedMonths.length} month(s)`
    );
    console.log(`  📅 Cached months: ${cachedMonths.join(", ")}`);

    // Check for months that need image downloads (only for months in range)
    console.log(`\n  🔍 Checking for missing images...`);
    for (const monthKey of cachedMonths) {
      // Skip months outside the specified range
      if (
        (startMonth || endMonth) &&
        !isMonthInRange(monthKey, startMonth, endMonth)
      ) {
        console.log(`  ⊘ Skipping ${monthKey} (outside date range)`);
        continue;
      }

      const [year, month] = monthKey.split("-");
      if (!hasImagesForMonth(year, month)) {
        console.log(
          `  📸 Month ${monthKey} missing images, re-fetching with fresh URLs...`
        );
        const monthMessages = existingMessages.filter((msg) => {
          const utcDate = new Date(msg.timestamp);
          const zonedDate = toZonedTime(utcDate, TIMEZONE);
          const msgMonthKey = `${zonedDate.getFullYear()}-${String(zonedDate.getMonth() + 1).padStart(2, "0")}`;
          return msgMonthKey === monthKey;
        });
        await refetchAndDownloadImagesForMonth(
          channelId,
          monthKey,
          monthMessages
        );
      }
    }
  } else {
    console.log(`  ℹ️  No existing cache found, fetching all messages...`);
  }

  const allMessages = [];
  let oldestMessageId = forceRewrite
    ? undefined
    : existingMessages.length > 0
      ? existingMessages[existingMessages.length - 1].id
      : undefined;
  let hasMore = true;
  let pageCount = 0;
  const seenIds = forceRewrite
    ? new Set()
    : new Set(existingMessages.map((m) => m.id));

  try {
    // Fetch messages in batches, going backwards in time
    while (hasMore) {
      pageCount++;
      const options = { limit: 100 };
      if (oldestMessageId) {
        options.before = oldestMessageId;
      }

      console.log(
        `  🔄 Fetching page ${pageCount}${oldestMessageId ? ` (before ${oldestMessageId})` : ""}...`
      );

      const messages = await getChannelMessages(channelId, options);

      if (!messages || messages.length === 0) {
        hasMore = false;
        break;
      }

      // Filter out already cached messages
      const newMessages = messages.filter((msg) => !seenIds.has(msg.id));

      if (newMessages.length > 0) {
        console.log(
          `  ✓ Fetched ${messages.length} messages, ${newMessages.length} new`
        );

        // Transform to cached message format
        const cachedMessages = [];
        for (const msg of newMessages) {
          const utcDate = new Date(msg.timestamp);
          const zonedDate = toZonedTime(utcDate, TIMEZONE);
          const year = zonedDate.getFullYear().toString();
          const month = String(zonedDate.getMonth() + 1).padStart(2, "0");
          const monthKey = `${year}-${month}`;

          // Skip messages outside date range (don't even download images)
          if (
            (startMonth || endMonth) &&
            !isMonthInRange(monthKey, startMonth, endMonth)
          ) {
            continue;
          }

          // Download images from attachments (only for messages in range)
          await downloadAttachmentImages(msg.attachments || [], year, month);

          cachedMessages.push({
            id: msg.id,
            author: {
              id: msg.author.id,
              username: msg.author.username,
              global_name: msg.author.global_name || null,
              avatar: msg.author.avatar || null,
            },
            content: msg.content,
            timestamp: msg.timestamp,
            attachments: (msg.attachments || []).map((att) => ({
              id: att.id,
              url: att.url,
              proxy_url: att.proxy_url,
              content_type: att.content_type,
            })),
            embeds: (msg.embeds || []).map((embed) => ({
              thumbnail: embed.thumbnail
                ? {
                    url: embed.thumbnail.url,
                    proxy_url: embed.thumbnail.proxy_url,
                  }
                : undefined,
              image: embed.image
                ? { url: embed.image.url, proxy_url: embed.image.proxy_url }
                : undefined,
            })),
            mentions: (msg.mentions || []).map((mention) => ({
              id: mention.id,
              username: mention.username,
              global_name: mention.global_name || null,
              avatar: mention.avatar || null,
            })),
            reactions: (msg.reactions || []).map((reaction) => ({
              emoji: {
                id: reaction.emoji.id || null,
                name: reaction.emoji.name || null,
              },
              count: reaction.count,
              me: reaction.me || false,
            })),
          });
        }

        allMessages.push(...cachedMessages);
        cachedMessages.forEach((msg) => seenIds.add(msg.id));
      } else {
        console.log(
          `  ⊘ All ${messages.length} messages already cached, stopping`
        );
        hasMore = false;
        break;
      }

      // Update oldest message ID for next iteration
      oldestMessageId = messages[messages.length - 1].id;

      // Stop if we got fewer messages than requested (reached the beginning)
      if (messages.length < 100) {
        hasMore = false;
      }

      // Add a small delay to be nice to the API (rate limiting is handled by discord.ts)
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (allMessages.length > 0) {
      console.log(`\n  💾 Caching ${allMessages.length} new messages...`);
      addMessagesToCache(channelId, allMessages);

      const stats = getCacheStats(channelId);
      console.log(
        `  ✓ Cache updated: ${stats.totalMessages} total messages across ${stats.months} month(s)`
      );
      if (stats.oldestMessage) {
        console.log(
          `  📅 Date range: ${new Date(stats.oldestMessage).toLocaleDateString()} to ${new Date(stats.newestMessage).toLocaleDateString()}`
        );
      }
    } else {
      console.log(
        `  ✓ Cache is up to date (or no messages in specified date range)`
      );
    }

    return allMessages.length;
  } catch (error) {
    console.error(
      `  ❌ Error fetching messages for ${channelName}:`,
      error.message
    );
    return 0;
  }
}

/**
 * Fetch latest 100 messages for a channel and save to "latest" folder
 */
async function fetchLatestMessages(channelId, channelName) {
  console.log(
    `\n📥 Fetching latest 100 messages for channel: ${channelName} (${channelId})`
  );

  try {
    // Fetch the 100 most recent messages
    const messages = await getChannelMessages(channelId, { limit: 100 });

    if (!messages || messages.length === 0) {
      console.log(`  ℹ️  No messages found`);
      return 0;
    }

    console.log(`  ✓ Fetched ${messages.length} messages`);

    // Transform to cached message format and download images
    const cachedMessages = [];
    for (const msg of messages) {
      // Download images to latest/discord/images (no month subfolder)
      await downloadAttachmentImages(
        msg.attachments || [],
        "latest",
        "discord"
      );

      cachedMessages.push({
        id: msg.id,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          global_name: msg.author.global_name || null,
          avatar: msg.author.avatar || null,
        },
        content: msg.content,
        timestamp: msg.timestamp,
        attachments: (msg.attachments || []).map((att) => ({
          id: att.id,
          url: att.url,
          proxy_url: att.proxy_url,
          content_type: att.content_type,
        })),
        embeds: (msg.embeds || []).map((embed) => ({
          thumbnail: embed.thumbnail
            ? { url: embed.thumbnail.url, proxy_url: embed.thumbnail.proxy_url }
            : undefined,
          image: embed.image
            ? { url: embed.image.url, proxy_url: embed.image.proxy_url }
            : undefined,
        })),
        mentions: (msg.mentions || []).map((mention) => ({
          id: mention.id,
          username: mention.username,
          global_name: mention.global_name || null,
          avatar: mention.avatar || null,
        })),
        reactions: (msg.reactions || []).map((reaction) => ({
          emoji: {
            id: reaction.emoji.id || null,
            name: reaction.emoji.name || null,
          },
          count: reaction.count,
          me: reaction.me || false,
        })),
      });
    }

    // Save to data/latest/discord/{channelId}/messages.json (no month subfolder)
    const dirPath = path.join(DATA_DIR, "latest", "discord", channelId);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, "messages.json");
    const cache = {
      messages: cachedMessages,
      cachedAt: new Date().toISOString(),
      newestMessageId: cachedMessages[0]?.id,
      oldestMessageId: cachedMessages[cachedMessages.length - 1]?.id,
    };

    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), "utf-8");
    console.log(
      `  💾 Saved ${cachedMessages.length} messages to latest/discord/${channelId}/messages.json`
    );

    return cachedMessages.length;
  } catch (error) {
    console.error(
      `  ❌ Error fetching latest messages for ${channelName}:`,
      error.message
    );
    return 0;
  }
}

/**
 * Main function - CLI entry point
 */
async function main() {
  console.log("🚀 Starting Discord message cache warmup...");
  console.log(`📂 DATA_DIR: ${DATA_DIR}`);

  // Verify that discord-cache is using the same DATA_DIR
  // (discord-cache reads DATA_DIR at module import time)
  if (!process.env.DATA_DIR) {
    console.log(`⚠️  WARNING: DATA_DIR not set in environment`);
    console.log(`   To use a custom directory, run: DATA_DIR=/path npm run fetch-discord\n`);
  } else {
    console.log(`✓ DATA_DIR is set in environment\n`);
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error(
      "❌ Error: DISCORD_BOT_TOKEN not set in environment variables"
    );
    process.exit(1);
  }

  // Parse month filter arguments
  const { startMonth, endMonth } = parseArgs();
  if (startMonth || endMonth) {
    console.log(
      `📅 Month filter: ${startMonth || "any"} to ${endMonth || "any"}\n`
    );
  }

  // Check for --force flag
  const forceRewrite =
    process.argv.includes("--force") || process.argv.includes("-f");
  if (forceRewrite) {
    console.log(
      "⚠️  Force rewrite enabled - will re-fetch all messages and images\n"
    );
  }

  const channelIds = getAllChannelIds();
  console.log(`📋 Found ${channelIds.length} unique channels to process\n`);

  let totalNewMessages = 0;
  let successCount = 0;
  let errorCount = 0;

  // First, fetch latest 100 messages for all channels (skip if month filter is set)
  let latestMessagesCount = 0;
  let latestSuccessCount = 0;
  let latestErrorCount = 0;

  if (!startMonth && !endMonth) {
    console.log("=".repeat(60));
    console.log("📌 Fetching latest 100 messages for all channels...");
    console.log("=".repeat(60));

    for (const channelId of channelIds) {
      const channelName = getChannelName(channelId);
      try {
        const count = await fetchLatestMessages(channelId, channelName);
        latestMessagesCount += count;
        latestSuccessCount++;
      } catch (error) {
        console.error(
          `❌ Failed to fetch latest messages for ${channelName}:`,
          error
        );
        latestErrorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Latest Messages Summary:");
    console.log(`  ✓ Successfully processed: ${latestSuccessCount} channel(s)`);
    console.log(`  ❌ Errors: ${latestErrorCount} channel(s)`);
    console.log(`  📥 Total latest messages cached: ${latestMessagesCount}`);
    console.log("=".repeat(60));
  } else {
    console.log("⊘ Skipping latest messages (month filter is set)\n");
  }

  // Then, fetch historical messages
  console.log("\n" + "=".repeat(60));
  console.log("📚 Fetching historical messages...");
  console.log("=".repeat(60));

  for (const channelId of channelIds) {
    const channelName = getChannelName(channelId);
    try {
      const newMessages = await fetchChannelHistory(
        channelId,
        channelName,
        forceRewrite,
        startMonth,
        endMonth
      );
      totalNewMessages += newMessages;
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to process channel ${channelName}:`, error);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Historical Messages Summary:");
  console.log(`  ✓ Successfully processed: ${successCount} channel(s)`);
  console.log(`  ❌ Errors: ${errorCount} channel(s)`);
  console.log(`  📥 Total new messages cached: ${totalNewMessages}`);
  console.log("=".repeat(60));

  if (errorCount > 0 || latestErrorCount > 0) {
    console.log(
      "\n⚠️  Some channels failed to process. Check the logs above for details."
    );
    process.exit(1);
  }

  console.log("\n✅ Discord message cache warmup completed successfully!");
}

// Run the script
main().catch((error) => {
  console.error("\n❌ Fatal error during cache warmup:", error);
  process.exit(1);
});
