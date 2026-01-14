/**
 * Unified warmup script for transaction cache (Stripe and Etherscan)
 *
 * This script fetches transactions for all accounts and stores them
 * in monthly cache files (data/year/month/finance/:chain/:accountSlug.:token.json).
 *
 * Features:
 * - Skips historical months that already have cache files
 * - Always fetches/updates the current month (new transactions may have occurred)
 * - Handles both Stripe and Etherscan accounts
 *
 * Usage:
 *   node scripts/warmup-transactions-cache.js
 *   node scripts/warmup-transactions-cache.js --month=2025-11
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY - Your Stripe secret key (required for Stripe accounts)
 *   ETHERSCAN_API_KEY - Your Etherscan API key (required for Etherscan accounts)
 *   DATA_DIR - Data directory (default: ./data)
 */

import dotenv from "dotenv";
import path from "path";
import { warmupTransactionCache } from "../src/lib/transaction-cache";

dotenv.config();

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let startMonth = undefined;
  let endMonth = undefined;

  for (const arg of args) {
    if (arg.startsWith("--month=")) {
      // Single month filter
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
 * Main function - CLI entry point
 */
async function main() {
  try {
    const { startMonth, endMonth } = parseArgs();
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

    await warmupTransactionCache({
      dataDir,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      etherscanApiKey: process.env.ETHERSCAN_API_KEY,
      startMonth,
      endMonth,
    });
  } catch (error) {
    console.error("\n✗ Error during cache warmup:", error);
    process.exit(1);
  }
}

// Run the script
main();
