/**
 * Warmup script for user token data cache
 *
 * This script computes token transaction data for each active Discord user per month.
 * For each month, it creates /data/:year/:month/contributors.json containing:
 * - User profile data (avatar, username, displayName)
 * - Wallet address (0x)
 * - Total tokens received (minted + incoming transfers)
 * - Total tokens spent (burnt + outgoing transfers)
 *
 * Features:
 * - Skips months that already have contributors.json (incremental updates)
 * - Combines Discord activity with blockchain transaction data
 * - Rate-limited API calls to respect service limits
 *
 * Usage:
 *   tsx scripts/warmup-users-cache.ts [year] [month]
 *   tsx scripts/warmup-users-cache.ts        # Processes all months with Discord data
 *
 * Environment variables:
 *   ETHERSCAN_API_KEY - Your Celoscan API key (required)
 */

import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { getAccountAddressFromDiscordUserId } from "../src/lib/citizenwallet";
import { parseTokenValue } from "../src/lib/etherscan";
import {
  getCachedWalletAddress,
  setCachedWalletAddress,
} from "../src/lib/wallet-address-cache";
import settings from "../src/settings/settings.json";

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CHT_CONFIG = settings.contributionToken;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface DiscordUser {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

interface UserTokenData extends DiscordUser {
  address: string | null;
  tokensReceived: number; // Total CHT received (minted + incoming transfers)
  tokensSpent: number; // Total CHT spent (burnt + outgoing transfers)
}

interface CHTTransaction {
  from: string;
  to: string;
  value: string;
  timeStamp: string;
}

/**
 * Get all active Discord users for a specific month
 * Combines users from all channel caches
 */
function getActiveUsersForMonth(
  year: string,
  month: string
): Map<string, DiscordUser> {
  const users = new Map<string, DiscordUser>();
  const discordDir = path.join(DATA_DIR, year, month, "channels", "discord");

  if (!fs.existsSync(discordDir)) {
    return users;
  }

  // Read all Discord channel directories
  const entries = fs.readdirSync(discordDir, { withFileTypes: true });

  for (const entry of entries) {
    try {
      let filePath: string;

      if (entry.isDirectory()) {
        // New structure: discord/channelId/messages.json
        filePath = path.join(discordDir, entry.name, "messages.json");
        if (!fs.existsSync(filePath)) continue;
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        // Old structure: discord/channelId.json
        filePath = path.join(discordDir, entry.name);
      } else {
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      // Extract users from messages
      if (data.messages && Array.isArray(data.messages)) {
        for (const message of data.messages) {
          if (message.author && message.author.id) {
            const userId = message.author.id;
            if (!users.has(userId)) {
              users.set(userId, {
                id: userId,
                username: message.author.username || userId,
                displayName:
                  message.author.global_name || message.author.username || null,
                avatar: message.author.avatar || null,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`  ⚠️  Error reading ${entry.name}:`, error);
    }
  }

  return users;
}

/**
 * Get CHT transactions for a specific month
 */
function getCHTTransactions(year: string, month: string): CHTTransaction[] {
  // Try newest path structure first: finance/celo/CHT.json
  const newestTokensFile = path.join(
    DATA_DIR,
    year,
    month,
    "finance",
    "celo",
    "CHT.json"
  );

  if (fs.existsSync(newestTokensFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(newestTokensFile, "utf-8"));
      return data.transactions || [];
    } catch (error) {
      console.error(`  ⚠️  Error reading CHT transactions:`, error);
      return [];
    }
  }

  // Try older path structure: celo/CHT/<address>.json
  const newTokensFile = path.join(
    DATA_DIR,
    year,
    month,
    "celo",
    "CHT",
    `${CHT_CONFIG.address.toLowerCase()}.json`
  );

  if (fs.existsSync(newTokensFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(newTokensFile, "utf-8"));
      return data.transactions || [];
    } catch (error) {
      console.error(`  ⚠️  Error reading CHT transactions:`, error);
      return [];
    }
  }

  // Fall back to oldest path structure: tokens/cht.json
  const oldTokensFile = path.join(DATA_DIR, year, month, "tokens", "cht.json");

  if (fs.existsSync(oldTokensFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(oldTokensFile, "utf-8"));
      return data.transactions || [];
    } catch (error) {
      console.error(`  ⚠️  Error reading CHT transactions:`, error);
      return [];
    }
  }

  return [];
}

/**
 * Calculate token stats for a user's wallet address
 */
function calculateTokenStats(
  walletAddress: string,
  transactions: CHTTransaction[]
): { received: number; spent: number } {
  let received = 0;
  let spent = 0;

  const normalizedAddress = walletAddress.toLowerCase();

  for (const tx of transactions) {
    const from = tx.from.toLowerCase();
    const to = tx.to.toLowerCase();
    const value = parseTokenValue(tx.value, CHT_CONFIG.decimals);

    // Tokens received (minted or incoming transfer)
    if (to === normalizedAddress) {
      received += value;
    }

    // Tokens spent (burnt or outgoing transfer)
    if (from === normalizedAddress && from !== ZERO_ADDRESS.toLowerCase()) {
      spent += value;
    }
  }

  return { received, spent };
}

/**
 * Process a single month and generate contributors.json
 */
async function processMonth(year: string, month: string): Promise<boolean> {
  console.log(`\n📅 Processing ${year}-${month}...`);

  const contributorsFile = path.join(
    DATA_DIR,
    year,
    month,
    "contributors.json"
  );

  // Skip if already exists
  if (fs.existsSync(contributorsFile)) {
    console.log(`  ⏭️  Skipping - contributors.json already exists`);
    return true;
  }

  // Get active users from Discord
  const activeUsers = getActiveUsersForMonth(year, month);
  console.log(`  Found ${activeUsers.size} active Discord users`);

  if (activeUsers.size === 0) {
    console.log(`  ⚠️  No active users found, skipping...`);
    return true;
  }

  // Get CHT transactions for this month
  const transactions = getCHTTransactions(year, month);
  console.log(`  Found ${transactions.length} CHT transactions`);

  if (transactions.length === 0) {
    console.log(`  ⚠️  No CHT transactions found, skipping...`);
    return true;
  }

  // Process each user
  const usersData: UserTokenData[] = [];
  let processedCount = 0;
  let withAddressCount = 0;
  let withTokensCount = 0;

  for (const [userId, user] of activeUsers) {
    processedCount++;

    // Show progress every 10 users
    if (processedCount % 10 === 0) {
      console.log(`  Processing user ${processedCount}/${activeUsers.size}...`);
    }

    try {
      // Get wallet address for Discord user (check cache first)
      let walletAddress = getCachedWalletAddress(userId);

      if (walletAddress === undefined) {
        // Not in cache, fetch from blockchain
        walletAddress = await getAccountAddressFromDiscordUserId(userId);
        setCachedWalletAddress(userId, walletAddress);
      }

      if (walletAddress && walletAddress !== ZERO_ADDRESS) {
        withAddressCount++;

        // Calculate token stats
        const stats = calculateTokenStats(walletAddress, transactions);

        usersData.push({
          ...user,
          address: walletAddress,
          tokensReceived: stats.received,
          tokensSpent: stats.spent,
        });

        if (stats.received > 0 || stats.spent > 0) {
          withTokensCount++;
        }
      } else {
        // User without wallet address
        usersData.push({
          ...user,
          address: null,
          tokensReceived: 0,
          tokensSpent: 0,
        });
      }
    } catch (error) {
      console.error(`  ⚠️  Error processing user ${userId}:`, error);
      // Add user with no token data
      usersData.push({
        ...user,
        address: null,
        tokensReceived: 0,
        tokensSpent: 0,
      });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Sort by tokens received (descending)
  usersData.sort((a, b) => b.tokensReceived - a.tokensReceived);

  // Write to cache file
  const outputData = {
    year,
    month,
    userCount: usersData.length,
    usersWithAddress: withAddressCount,
    usersWithTokens: withTokensCount,
    totalTokensReceived: usersData.reduce(
      (sum, u) => sum + u.tokensReceived,
      0
    ),
    totalTokensSpent: usersData.reduce((sum, u) => sum + u.tokensSpent, 0),
    users: usersData,
    cachedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    contributorsFile,
    JSON.stringify(outputData, null, 2),
    "utf-8"
  );

  console.log(`  ✓ Processed ${usersData.length} users`);
  console.log(`    - With wallet address: ${withAddressCount}`);
  console.log(`    - With token activity: ${withTokensCount}`);
  console.log(`    - Total received: ${outputData.totalTokensReceived} CHT`);
  console.log(`    - Total spent: ${outputData.totalTokensSpent} CHT`);
  console.log(`  ✓ Cached to ${year}/${month}/contributors.json`);

  return true;
}

/**
 * Get all existing year/month directories that have Discord data
 */
function getExistingMonths(): string[] {
  const months: string[] = [];

  if (!fs.existsSync(DATA_DIR)) {
    return months;
  }

  const yearDirs = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const year of yearDirs) {
    const yearPath = path.join(DATA_DIR, year);
    const monthDirs = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    for (const month of monthDirs) {
      // Only include months that have Discord data
      const discordDir = path.join(yearPath, month, "channels", "discord");
      if (fs.existsSync(discordDir)) {
        months.push(`${year}-${month}`);
      }
    }
  }

  return months;
}

/**
 * Main function
 */
async function main() {
  console.log("👥 Generating user token data cache...");
  console.log(`📂 DATA_DIR: ${DATA_DIR}`);
  console.log(`Token: ${CHT_CONFIG.symbol} (${CHT_CONFIG.name})`);
  console.log(`Chain: ${CHT_CONFIG.chain} (chainId: ${CHT_CONFIG.chainId})\n`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const flagArgs = args.filter((a) => a.startsWith("--"));
  const positionalArgs = args.filter(
    (a) => !a.startsWith("--")
  );

  let startMonth: string | null = null;
  let endMonth: string | null = null;

  for (const arg of flagArgs) {
    if (arg.startsWith("--month=")) {
      const m = arg.split("=")[1];
      startMonth = m;
      endMonth = m;
    } else if (arg.startsWith("--start-month=")) {
      startMonth = arg.split("=")[1];
    } else if (arg.startsWith("--end-month=")) {
      endMonth = arg.split("=")[1];
    }
  }

  // Support positional args: warmup-users-cache.ts [year] [month]
  if (!startMonth && !endMonth && positionalArgs.length >= 2) {
    const [year, month] = positionalArgs;
    const success = await processMonth(year, month);

    if (success) {
      console.log("\n✅ Done!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Completed with errors (see above)");
      process.exit(0);
    }
    return;
  }

  // Process months (filtered by range if provided)
  const months = getExistingMonths();

  if (months.length === 0) {
    console.log("⚠️  No months with Discord data found in data/");
    return;
  }

  const filteredMonths = months.filter((monthKey) => {
    if (startMonth && monthKey < startMonth) return false;
    if (endMonth && monthKey > endMonth) return false;
    return true;
  });

  if (startMonth || endMonth) {
    console.log(
      `📅 Month filter: ${startMonth || "any"} to ${endMonth || "any"}`
    );
  }
  console.log(`📊 Found ${filteredMonths.length} months to process`);

  let successCount = 0;
  let skippedCount = 0;

  for (const monthKey of filteredMonths) {
    const [year, month] = monthKey.split("-");

    // Check if already exists
    const contributorsFile = path.join(
      DATA_DIR,
      year,
      month,
      "contributors.json"
    );
    if (fs.existsSync(contributorsFile)) {
      skippedCount++;
      continue;
    }

    const success = await processMonth(year, month);
    if (success) {
      successCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Summary:`);
  console.log(`  ✓ Processed: ${successCount}`);
  console.log(`  ⏭️  Skipped (already cached): ${skippedCount}`);
  console.log(`  📁 Total months: ${filteredMonths.length}`);
  console.log("=".repeat(50));
  console.log("\n✅ Done!");
}

// Run the script
main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
