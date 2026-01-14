/**
 * Fetch CHT (ContributionToken) transactions from CELO chain
 *
 * This script fetches CHT token transfers to track minting and burning activity.
 * Unlike financial accounts (EURe/EURb), CHT tokens represent community contributions.
 *
 * Usage:
 *   tsx scripts/fetch-cht-tokens.ts [year] [month]
 *   tsx scripts/fetch-cht-tokens.ts        # Fetches all months with existing data
 *
 * Environment variables:
 *   ETHERSCAN_API_KEY - Your Celoscan API key (required)
 */

import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { fromZonedTime } from "date-fns-tz";
import { rateLimitedApiCall } from "../src/lib/etherscan";
import settings from "../src/settings/settings.json";

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const CHT_CONFIG = settings.contributionToken;
const FORCE_FETCH = process.argv.includes("--force");
const TIMEZONE = process.env.TZ || "Europe/Brussels";

interface CHTAccount {
  address: string;
  slug: string;
}

/**
 * Fetch all token transfers for CHT contract
 * Uses rate-limited API call with retry logic (max 3 requests/second)
 */
async function fetchAllCHTTransfers(apiKey: string): Promise<any[]> {
  const baseUrl = `https://api.etherscan.io/v2/api?chainid=${CHT_CONFIG.chainId}`;
  const url = `${baseUrl}&module=account&action=tokentx&contractaddress=${CHT_CONFIG.address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;

  console.log(`  Fetching ALL CHT token transfers from contract...`);

  return rateLimitedApiCall(url, async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CHT transfers: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === "0" && data.message !== "No transactions found") {
      throw new Error(`Celoscan API error: ${data.message}`, { cause: data });
    }

    return Array.isArray(data.result) ? data.result : [];
  });
}

/**
 * Get all existing year/month directories
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
      months.push(`${year}-${month}`);
    }
  }

  return months;
}

/**
 * Filter transactions to a specific month
 * Uses local timezone (TZ env variable or Europe/Brussels) for month boundaries
 */
function filterToMonth(
  transactions: any[],
  year: string,
  month: string
): any[] {
  // Create date in local timezone (midnight on the 1st of the month)
  const startDateLocal = new Date(
    parseInt(year),
    parseInt(month) - 1,
    1,
    0,
    0,
    0
  );
  const endDateLocal = new Date(parseInt(year), parseInt(month), 1, 0, 0, 0);

  // Convert to UTC timestamps for comparison with blockchain timestamps
  const startDateUtc = fromZonedTime(startDateLocal, TIMEZONE);
  const endDateUtc = fromZonedTime(endDateLocal, TIMEZONE);

  const startTimestamp = Math.floor(startDateUtc.getTime() / 1000);
  const endTimestamp = Math.floor(endDateUtc.getTime() / 1000);

  return transactions.filter((tx) => {
    const txTimestamp = Number.parseInt(tx.timeStamp);
    return txTimestamp >= startTimestamp && txTimestamp < endTimestamp;
  });
}

/**
 * Fetch and cache CHT transactions for a specific month
 * Returns true if successful, false if failed (doesn't throw to avoid failing build)
 */
async function fetchCHTForMonth(
  year: string,
  month: string,
  apiKey: string
): Promise<boolean> {
  console.log(`\n📅 Processing ${year}-${month}...`);

  // Use finance structure: data/year/month/finance/chain/tokenSymbol.json
  const financeDir = path.join(
    DATA_DIR,
    year,
    month,
    "finance",
    CHT_CONFIG.chain
  );
  const cacheFile = path.join(financeDir, `${CHT_CONFIG.symbol}.json`);

  // Check if data already exists (unless force flag is set)
  if (!FORCE_FETCH && fs.existsSync(cacheFile)) {
    console.log(
      `  ⊘ Skipping ${year}-${month} (already exists, use --force to override)`
    );
    return true;
  }

  // Ensure directory exists
  if (!fs.existsSync(financeDir)) {
    fs.mkdirSync(financeDir, { recursive: true });
  }

  try {
    // Fetch ALL CHT token transfers from the contract
    const allTransfers = await fetchAllCHTTransfers(apiKey);

    // Filter to this specific month
    const monthlyTransfers = filterToMonth(allTransfers, year, month);

    console.log(
      `  Found ${monthlyTransfers.length} CHT transactions in ${year}-${month}`
    );

    // Count minting and burning for info
    const minted = monthlyTransfers.filter(
      (tx: any) =>
        tx.from.toLowerCase() === "0x0000000000000000000000000000000000000000"
    ).length;
    const burnt = monthlyTransfers.filter(
      (tx: any) =>
        tx.to.toLowerCase() === "0x0000000000000000000000000000000000000000"
    ).length;

    console.log(`    - Minted: ${minted} transactions`);
    console.log(`    - Burnt: ${burnt} transactions`);
    console.log(
      `    - Regular transfers: ${monthlyTransfers.length - minted - burnt} transactions`
    );

    // Write CHT transactions to cache file
    fs.writeFileSync(
      cacheFile,
      JSON.stringify(
        {
          token: {
            symbol: CHT_CONFIG.symbol,
            name: CHT_CONFIG.name,
            address: CHT_CONFIG.address,
            decimals: CHT_CONFIG.decimals,
            chain: CHT_CONFIG.chain,
            chainId: CHT_CONFIG.chainId,
          },
          transactions: monthlyTransfers,
          cachedAt: new Date().toISOString(),
          transactionCount: monthlyTransfers.length,
        },
        null,
        2
      ),
      "utf-8"
    );

    console.log(
      `  ✓ Cached ${monthlyTransfers.length} CHT transactions in ${year}/${month}/finance/${CHT_CONFIG.chain}/${CHT_CONFIG.symbol}.json`
    );
    return true;
  } catch (error) {
    console.error(
      `  ✗ Error fetching CHT transactions for ${year}-${month}:`,
      error
    );
    console.error(`  ⚠️  Build will continue despite this error`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    console.error("❌ ETHERSCAN_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log("🪙 Fetching CHT (ContributionToken) transactions from CELO...");
  console.log(`Token: ${CHT_CONFIG.symbol} (${CHT_CONFIG.name})`);
  console.log(`Address: ${CHT_CONFIG.address}`);
  console.log(`Chain: ${CHT_CONFIG.chain} (chainId: ${CHT_CONFIG.chainId})`);
  console.log(
    `Rate limit: 3 requests/second with automatic retry on failure\n`
  );

  // Check if specific year/month provided
  const args = process.argv.slice(2);

  if (args.length >= 2) {
    // Fetch specific month
    const [year, month] = args;
    const success = await fetchCHTForMonth(year, month, apiKey);

    if (success) {
      console.log("\n✅ Done!");
      process.exit(0);
    } else {
      console.log("\n⚠️  Completed with errors (see above)");
      process.exit(0); // Exit with 0 to not fail build
    }
  } else {
    // Fetch all existing months
    const months = getExistingMonths();

    if (months.length === 0) {
      console.log("⚠️  No existing month directories found in data/");
      return;
    }

    console.log(`📊 Found ${months.length} months to process`);

    let successCount = 0;
    let failureCount = 0;

    for (const monthKey of months) {
      const [year, month] = monthKey.split("-");
      const success = await fetchCHTForMonth(year, month, apiKey);

      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // No need for manual delay - rate limiting is handled automatically
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Summary:`);
    console.log(`  ✓ Successful: ${successCount}/${months.length}`);
    if (failureCount > 0) {
      console.log(`  ✗ Failed: ${failureCount}/${months.length}`);
      console.log(`  ⚠️  Some months failed but build continues`);
    }
    console.log("=".repeat(50));
    console.log("\n✅ Done!");
  }
}

// Run the script
// Errors are caught and logged but don't fail the build
main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  console.error("⚠️  Build continues despite error");
  process.exit(0); // Exit with 0 to not fail build
});
