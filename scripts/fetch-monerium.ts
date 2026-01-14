/**
 * Fetch Monerium transactions and store them in monthly cache files
 *
 * This script fetches all historical Monerium orders and stores them
 * in data/:year/:month/private/monerium/:0xAddress.json files.
 *
 * Usage:
 *   tsx scripts/fetch-monerium.ts
 *
 * Environment variables:
 *   MONERIUM_CLIENT_ID - Your Monerium client ID
 *   MONERIUM_CLIENT_SECRET - Your Monerium client secret
 */

import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { getOrders, type MoneriumOrder } from "../src/lib/monerium-node";

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

/**
 * Get month key from a date (YYYY-MM format)
 */
function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get cache file path for a specific month and address
 * Format: data/year/month/private/monerium/:0xAddress.json
 */
function getCacheFilePath(
  monthKey: string,
  address: string,
  dataDir: string = DATA_DIR
): string {
  const [year, month] = monthKey.split("-");
  return path.join(
    dataDir,
    year,
    month,
    "private",
    "monerium",
    `${address}.json`
  );
}

/**
 * Group orders by month and address
 */
function groupOrdersByMonthAndAddress(
  orders: MoneriumOrder[]
): Map<string, Map<string, MoneriumOrder[]>> {
  const grouped = new Map<string, Map<string, MoneriumOrder[]>>();

  for (const order of orders) {
    const processedDate = new Date(order.meta.processedAt);
    const monthKey = getMonthKey(processedDate);
    const address = order.address.toLowerCase();

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, new Map());
    }

    const monthMap = grouped.get(monthKey)!;
    if (!monthMap.has(address)) {
      monthMap.set(address, []);
    }

    monthMap.get(address)!.push(order);
  }

  return grouped;
}

/**
 * Write orders to cache file
 */
function writeCacheFile(
  monthKey: string,
  address: string,
  orders: MoneriumOrder[],
  dataDir: string = DATA_DIR
): void {
  const filePath = getCacheFilePath(monthKey, address, dataDir);
  const dirPath = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Sort orders by processed date (newest first)
  const sortedOrders = orders.sort(
    (a, b) =>
      new Date(b.meta.processedAt).getTime() -
      new Date(a.meta.processedAt).getTime()
  );

  const cacheData = {
    orders: sortedOrders,
    cachedAt: new Date().toISOString(),
    orderCount: sortedOrders.length,
    address: address,
    month: monthKey,
  };

  fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), "utf-8");
  console.log(
    `✓ Cached ${sortedOrders.length} orders for ${address} in ${monthKey}/private/monerium/${address}.json`
  );
}

/**
 * Check if cache file exists
 */
function cacheFileExists(
  monthKey: string,
  address: string,
  dataDir: string = DATA_DIR
): boolean {
  const filePath = getCacheFilePath(monthKey, address, dataDir);
  return fs.existsSync(filePath);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log("Fetching Monerium orders...\n");

    // Fetch all orders
    const orders = await getOrders();

    if (!orders || orders.length === 0) {
      console.log("No orders found");
      return;
    }

    console.log(`Found ${orders.length} total orders\n`);

    // Group orders by month and address
    const grouped = groupOrdersByMonthAndAddress(orders);

    // Write cache files
    let totalCached = 0;
    for (const [monthKey, addressMap] of grouped.entries()) {
      for (const [address, monthOrders] of addressMap.entries()) {
        writeCacheFile(monthKey, address, monthOrders);
        totalCached += monthOrders.length;
      }
    }

    console.log(
      `\n✓ Successfully cached ${totalCached} orders across ${grouped.size} month(s)`
    );
  } catch (error) {
    console.error("\n✗ Error fetching Monerium orders:", error);
    process.exit(1);
  }
}

// Run the script
main();
