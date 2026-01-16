/**
 * Transaction cache management utilities
 *
 * This module provides functions to fetch, cache, and manage transactions
 * from Stripe and Etherscan providers. Transactions are stored in monthly
 * cache files organized by year/month/accountSlug.json.
 */

import * as fs from "fs";
import * as path from "path";
import { getMonthKey, getMonthKeyFromDate } from "./stripe";
import {
  fetchAllTokenTransfers,
  fetchTokenBalance,
  parseTokenBalance,
} from "./etherscan";
import {
  fetchStripeBalance,
  calculateStripeBalance,
  StripeTransaction,
} from "./stripe";
import type { TokenTransfer } from "./etherscan";

export interface AccountData {
  slug: string;
  balance: number;
  lastTransactionTimestamp: number | null;
}

export interface TransactionCacheOptions {
  dataDir?: string;
  settingsFile?: string;
  stripeSecretKey?: string;
  etherscanApiKey?: string;
  startMonth?: string; // Format: YYYY-MM (e.g., "2025-11")
  endMonth?: string; // Format: YYYY-MM (e.g., "2025-11")
  force?: boolean; // Force re-fetch even if cache exists
}

/**
 * Get current month key (YYYY-MM format)
 */
export function getCurrentMonthKey(): string {
  return getMonthKeyFromDate(new Date());
}

/**
 * Check if a month key is within the specified date range
 */
export function isMonthInRange(
  monthKey: string,
  startMonth?: string,
  endMonth?: string
): boolean {
  if (!startMonth && !endMonth) return true;
  if (startMonth && monthKey < startMonth) return false;
  if (endMonth && monthKey > endMonth) return false;
  return true;
}

/**
 * Get cache file path for a specific month and account
 * Format:
 * - Stripe: /:year/:month/finance/stripe/:accountId.json
 * - Blockchain: /:year/:month/finance/:chain/:accountSlug.:tokenSymbol.json
 * Example: 2025/11/finance/gnosis/savings.EURe.json
 * Example: 2025/11/finance/stripe/acct_1Nn0FaFAhaWeDyow.json
 */
export function getMonthlyCacheFilePath(
  monthKey: string,
  accountSlug: string,
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  provider?: string,
  address?: string,
  chain?: string,
  tokenSymbol?: string,
  currency?: string,
  accountId?: string
): string {
  const [year, month] = monthKey.split("-");

  if (provider === "stripe") {
    // New structure: /:year/:month/finance/stripe/:accountId.json
    // Use accountId if provided, otherwise fall back to accountSlug
    const fileName = `${accountId || accountSlug}.json`;
    return path.join(dataDir, year, month, "finance", "stripe", fileName);
  } else if (provider === "etherscan" && chain && tokenSymbol) {
    // New structure: /:year/:month/finance/:chain/:accountSlug.:tokenSymbol.json
    const fileName = `${accountSlug}.${tokenSymbol}.json`;
    return path.join(dataDir, year, month, "finance", chain, fileName);
  }

  // Fallback for backward compatibility
  return path.join(
    dataDir,
    year,
    month,
    "finance",
    "stripe",
    `${accountId || accountSlug}.json`
  );
}

/**
 * Check if cache file exists for a month and account
 */
export function cacheFileExists(
  monthKey: string,
  accountSlug: string,
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  provider?: string,
  address?: string,
  chain?: string,
  tokenSymbol?: string,
  currency?: string,
  accountId?: string
): boolean {
  const filePath = getMonthlyCacheFilePath(
    monthKey,
    accountSlug,
    dataDir,
    provider,
    address,
    chain,
    tokenSymbol,
    currency,
    accountId
  );
  return fs.existsSync(filePath);
}

/**
 * Write monthly transactions to cache file
 */
export function writeMonthlyTransactions(
  monthKey: string,
  accountSlug: string,
  transactions: (StripeTransaction | TokenTransfer)[],
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  provider?: string,
  address?: string,
  chain?: string,
  tokenSymbol?: string,
  currency?: string,
  accountId?: string
): void {
  try {
    const filePath = getMonthlyCacheFilePath(
      monthKey,
      accountSlug,
      dataDir,
      provider,
      address,
      chain,
      tokenSymbol,
      currency,
      accountId
    );
    // Ensure nested directory structure exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          transactions,
          cachedAt: new Date().toISOString(),
          transactionCount: transactions.length,
        },
        null,
        2
      ),
      "utf-8"
    );
    const fileName = path.basename(filePath);
    const parentDir = path.basename(path.dirname(filePath));
    const grandparentDir = path.basename(path.dirname(path.dirname(filePath)));
    console.log(
      `✓ Cached ${transactions.length} transactions for ${accountSlug} in ${monthKey}/${grandparentDir}/${parentDir}/${fileName}`
    );
  } catch (error) {
    console.error(
      `Error writing monthly cache file for ${accountSlug} in ${monthKey}:`,
      error
    );
    throw error;
  }
}

/**
 * Get all existing cache months for an account
 */
export function getExistingCacheMonths(
  accountSlug: string,
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  provider?: string,
  address?: string,
  chain?: string,
  tokenSymbol?: string,
  currency?: string,
  accountId?: string
): Set<string> {
  const existingMonths = new Set<string>();

  try {
    if (!fs.existsSync(dataDir)) {
      return existingMonths;
    }

    // Read all year directories
    const yearDirs = fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    for (const year of yearDirs) {
      const yearPath = path.join(dataDir, year);

      // Read all month directories in this year
      const monthDirs = fs
        .readdirSync(yearPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
        .map((dirent) => dirent.name)
        .sort();

      for (const month of monthDirs) {
        const monthKey = `${year}-${month}`;
        const cacheFile = getMonthlyCacheFilePath(
          monthKey,
          accountSlug,
          dataDir,
          provider,
          address,
          chain,
          tokenSymbol,
          currency,
          accountId
        );
        if (fs.existsSync(cacheFile)) {
          existingMonths.add(monthKey);
        }
      }
    }
  } catch (error) {
    console.error(`Error checking existing cache months:`, error);
  }

  return existingMonths;
}

/**
 * Fetch transactions from Stripe API with pagination
 * Only fetches transactions for months that don't have cache files
 */
export async function fetchStripeTransactions(
  accountSlug: string,
  stripeSecretKey: string,
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  currency?: string,
  startMonth?: string,
  endMonth?: string,
  accountId?: string
): Promise<StripeTransaction[]> {
  const currentMonth = getCurrentMonthKey();
  const existingMonths = getExistingCacheMonths(
    accountSlug,
    dataDir,
    "stripe",
    undefined,
    undefined,
    undefined,
    currency,
    accountId
  );

  // If all historical months are cached, only fetch current month
  // Otherwise, fetch all transactions (we'll filter later)
  const shouldFetchAll = existingMonths.size === 0;

  // Smart date filtering: If we have cached months and no explicit date filter,
  // only fetch the current month to avoid unnecessary API calls
  if (!shouldFetchAll && !startMonth && !endMonth) {
    startMonth = currentMonth;
    endMonth = currentMonth;
    console.log(
      `Found ${existingMonths.size} existing cache month(s) for ${accountSlug}`
    );
    console.log(
      `  Cached months: ${Array.from(existingMonths).sort().join(", ")}`
    );
    console.log(
      `  Will only fetch current month (${currentMonth}) to avoid redundant API calls\n`
    );
  } else if (!shouldFetchAll) {
    console.log(
      `Found ${existingMonths.size} existing cache month(s) for ${accountSlug}`
    );
    console.log(
      `  Cached months: ${Array.from(existingMonths).sort().join(", ")}`
    );
    console.log(
      `  Will fetch all transactions and skip already-cached historical months\n`
    );
  }

  const headers = {
    Authorization: `Bearer ${stripeSecretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const allTransactions: StripeTransaction[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;
  let pageCount = 0;
  let shouldStop = false;

  console.log("Fetching transactions from Stripe...");

  while (hasMore && !shouldStop) {
    pageCount++;
    const url = new URL("https://api.stripe.com/v1/balance_transactions");
    url.searchParams.set("limit", "100");
    url.searchParams.set("expand[]", "data.source");

    // Add date filtering if startMonth or endMonth is specified
    if (startMonth || endMonth) {
      if (startMonth) {
        // Convert YYYY-MM to Unix timestamp (start of month)
        const [year, month] = startMonth.split("-");
        const startDate = new Date(
          Date.UTC(parseInt(year), parseInt(month) - 1, 1)
        );
        const startTimestamp = Math.floor(startDate.getTime() / 1000);
        url.searchParams.set("created[gte]", startTimestamp.toString());
      }
      if (endMonth) {
        // Convert YYYY-MM to Unix timestamp (end of month)
        const [year, month] = endMonth.split("-");
        const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 1)); // First day of next month
        const endTimestamp = Math.floor(endDate.getTime() / 1000);
        url.searchParams.set("created[lt]", endTimestamp.toString());
      }
    }

    if (startingAfter) {
      url.searchParams.set("starting_after", startingAfter);
    }

    try {
      const response = await fetch(url.toString(), { headers });
      if (!response.ok) {
        throw new Error(
          `Stripe API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        // Filter out transactions from months that already have cache files
        const filteredTransactions = data.data.filter(
          (tx: StripeTransaction) => {
            const monthKey = getMonthKey(tx.created);
            // Always include current month, skip historical months that are cached
            return monthKey === currentMonth || !existingMonths.has(monthKey);
          }
        );

        // Sanitize transactions to remove sensitive fields
        const sanitizedTransactions = filteredTransactions.map((tx: any) => {
          // Create a deep copy and remove sensitive fields
          const sanitized = { ...tx };

          // Remove top-level sensitive fields
          delete sanitized.billing_details;
          delete sanitized.email;
          delete sanitized.receipt_email;
          delete sanitized.payment_method_details;
          delete sanitized.shipping;
          delete sanitized.destination_details;

          // Remove sensitive fields from source if it exists
          if (sanitized.source) {
            const cleanSource = { ...sanitized.source };
            delete cleanSource.billing_details;
            delete cleanSource.email;
            delete cleanSource.receipt_email;
            delete cleanSource.payment_method_details;
            delete cleanSource.shipping;
            delete cleanSource.destination_details;

            // Also clean source.metadata if it exists
            if (cleanSource.metadata) {
              const cleanSourceMetadata = { ...cleanSource.metadata };
              delete cleanSourceMetadata.email;
              delete cleanSourceMetadata.billing_details;
              delete cleanSourceMetadata.shipping;
              cleanSource.metadata = cleanSourceMetadata;
            }

            sanitized.source = cleanSource;
          }

          // Also remove from metadata if it exists
          if (sanitized.metadata) {
            const cleanMetadata = { ...sanitized.metadata };
            delete cleanMetadata.email;
            delete cleanMetadata.billing_details;
            delete cleanMetadata.shipping;
            sanitized.metadata = cleanMetadata;
          }

          return sanitized;
        });

        allTransactions.push(...sanitizedTransactions);

        // Check if we've gone past all uncached months
        // If all transactions in this page are from cached months (and not current month), we can stop
        const allFromCachedMonths = data.data.every((tx: StripeTransaction) => {
          const monthKey = getMonthKey(tx.created);
          return monthKey !== currentMonth && existingMonths.has(monthKey);
        });

        if (allFromCachedMonths && existingMonths.size > 0) {
          console.log(
            `  Reached cached months, stopping fetch (found ${allTransactions.length} new transactions)`
          );
          shouldStop = true;
          hasMore = false;
        } else {
          startingAfter = data.data[data.data.length - 1].id;
          hasMore = data.has_more;
        }

        console.log(
          `  Page ${pageCount}: Fetched ${data.data.length} transactions, kept ${filteredTransactions.length} (total: ${allTransactions.length})`
        );
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Error fetching page ${pageCount}:`, error);
      throw error;
    }
  }

  console.log(`\n✓ Fetched ${allTransactions.length} transactions to cache\n`);
  return allTransactions;
}

/**
 * Fetch all token transfers from Etherscan API using lib function
 * This uses rate-limited and cached API calls
 */
export async function fetchAllEtherscanTransactions(
  account: {
    slug: string;
    name: string;
    chainId: number;
    chain?: string;
    token: { address: string; symbol: string };
    address: string;
  },
  etherscanApiKey: string,
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  startMonth?: string,
  endMonth?: string
): Promise<TokenTransfer[]> {
  const { chainId, token, address } = account;
  const currentMonth = getCurrentMonthKey();

  // Check for existing cached months
  const existingMonths = getExistingCacheMonths(
    account.slug,
    dataDir,
    "etherscan",
    address,
    account.chain,
    token.symbol
  );

  // Smart optimization: If we have cached months and no explicit date filter,
  // only fetch current month
  let effectiveStartMonth = startMonth;
  let effectiveEndMonth = endMonth;

  if (existingMonths.size > 0 && !startMonth && !endMonth) {
    effectiveStartMonth = currentMonth;
    effectiveEndMonth = currentMonth;
    console.log(
      `Found ${existingMonths.size} existing cache month(s) for ${account.slug}`
    );
    console.log(
      `  Cached months: ${Array.from(existingMonths).sort().join(", ")}`
    );
    console.log(
      `  Will only fetch current month (${currentMonth}) to avoid redundant API calls\n`
    );
  }

  console.log(`Fetching transactions for ${account.slug} (${account.name})...`);

  try {
    const transfers = await fetchAllTokenTransfers(
      chainId,
      token.address,
      address,
      etherscanApiKey
    );

    // Filter by date if we set date constraints
    let filteredTransfers = transfers;
    if (effectiveStartMonth || effectiveEndMonth) {
      filteredTransfers = transfers.filter((tx) => {
        const monthKey = getMonthKey(Number.parseInt(tx.timeStamp));
        return isMonthInRange(monthKey, effectiveStartMonth, effectiveEndMonth);
      });
    }

    console.log(`  ✓ Fetched ${filteredTransfers.length} transactions${effectiveStartMonth ? ` for ${effectiveStartMonth}` : ''}\n`);
    return filteredTransfers;
  } catch (error) {
    console.error(`Error fetching transactions for ${account.slug}:`, error);
    throw error;
  }
}

/**
 * Group transactions by month and save to cache files (skipping existing historical months)
 */
export function cacheTransactionsByMonth(
  accountSlug: string,
  transactions: StripeTransaction[] | TokenTransfer[],
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  provider?: string,
  address?: string,
  chain?: string,
  tokenSymbol?: string,
  currency?: string,
  startMonth?: string,
  endMonth?: string,
  accountId?: string,
  force: boolean = false
): void {
  const currentMonth = getCurrentMonthKey();

  // Group transactions by month
  const transactionsByMonth = new Map<
    string,
    (StripeTransaction | TokenTransfer)[]
  >();

  transactions.forEach((tx) => {
    // Handle both Stripe (created) and Etherscan (timeStamp) formats
    const timestamp =
      "created" in tx && tx.created !== undefined
        ? tx.created
        : "timeStamp" in tx && tx.timeStamp !== undefined
          ? Number.parseInt(tx.timeStamp)
          : null;

    if (timestamp === null) {
      console.warn(`Warning: Transaction missing timestamp, skipping:`, tx);
      return;
    }

    const monthKey = getMonthKey(timestamp);
    if (!transactionsByMonth.has(monthKey)) {
      transactionsByMonth.set(monthKey, []);
    }
    transactionsByMonth.get(monthKey)!.push(tx);
  });

  // Sort months chronologically
  const sortedMonths = Array.from(transactionsByMonth.keys()).sort();

  console.log(
    `Grouping ${accountSlug} transactions into ${sortedMonths.length} months...\n`
  );

  let skippedCount = 0;
  let cachedCount = 0;

  // Save each month to a separate cache file
  sortedMonths.forEach((monthKey) => {
    const monthTransactions = transactionsByMonth.get(monthKey)!;

    // Skip months outside the specified date range
    if (!isMonthInRange(monthKey, startMonth, endMonth)) {
      console.log(
        `⊘ Skipping ${accountSlug} in ${monthKey} (outside date range)`
      );
      skippedCount++;
      return;
    }

    // Skip historical months that already have cache files (unless it's the current month or force is enabled)
    if (
      !force &&
      monthKey !== currentMonth &&
      cacheFileExists(
        monthKey,
        accountSlug,
        dataDir,
        provider,
        address,
        chain,
        tokenSymbol,
        currency,
        accountId
      )
    ) {
      console.log(
        `⊘ Skipping ${accountSlug} in ${monthKey} (cache already exists)`
      );
      skippedCount++;
      return;
    }

    // Sort transactions by date (most recent first)
    // Check first transaction to determine type
    const firstTx = monthTransactions[0];
    if ("created" in firstTx && firstTx.created !== undefined) {
      // Stripe transactions
      monthTransactions.sort(
        (a, b) =>
          (b as StripeTransaction).created - (a as StripeTransaction).created
      );
    } else if ("timeStamp" in firstTx && firstTx.timeStamp !== undefined) {
      // Etherscan transactions
      monthTransactions.sort(
        (a, b) =>
          Number.parseInt((b as TokenTransfer).timeStamp) -
          Number.parseInt((a as TokenTransfer).timeStamp)
      );
    }

    writeMonthlyTransactions(
      monthKey,
      accountSlug,
      monthTransactions,
      dataDir,
      provider,
      address,
      chain,
      tokenSymbol,
      currency,
      accountId
    );
    cachedCount++;
  });

  console.log(
    `✓ Cached ${cachedCount} month(s) for ${accountSlug}, skipped ${skippedCount} existing month(s)`
  );
  if (sortedMonths.length > 0) {
    console.log(`  Months: ${sortedMonths.join(", ")}\n`);
  }
}

/**
 * Process Stripe account
 */
export async function processStripeAccount(
  account: {
    slug: string;
    name: string;
    currency?: string;
    accountId?: string;
  },
  stripeSecretKey: string,
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  startMonth?: string,
  endMonth?: string,
  force: boolean = false
): Promise<AccountData> {
  try {
    console.log(
      `\nProcessing Stripe account: ${account.slug} (${account.name})\n`
    );

    // Fetch transactions (only for months that don't have cache files)
    const currency = account.currency || "EUR";
    const transactions = await fetchStripeTransactions(
      account.slug,
      stripeSecretKey,
      dataDir,
      currency,
      startMonth,
      endMonth,
      account.accountId
    );

    // Get last transaction timestamp from existing cache or new transactions
    let lastTransactionTimestamp: number | null = null;

    if (transactions.length > 0) {
      // Group by month and cache (skipping existing historical months unless force is enabled)
      cacheTransactionsByMonth(
        account.slug,
        transactions,
        dataDir,
        "stripe",
        undefined,
        undefined,
        undefined,
        currency,
        startMonth,
        endMonth,
        account.accountId,
        force
      );
      lastTransactionTimestamp = transactions[0].created; // Already sorted by most recent first
    } else {
      // Try to get last transaction from cached data
      console.log(`No new transactions to cache for ${account.slug}.`);
      const allCachedMonths = getExistingCacheMonths(
        account.slug,
        dataDir,
        "stripe",
        undefined,
        undefined,
        undefined,
        currency
      );
      if (allCachedMonths.size > 0) {
        // Read the most recent month's transactions to get last timestamp
        const sortedMonths = Array.from(allCachedMonths).sort().reverse();
        for (const monthKey of sortedMonths) {
          const filePath = getMonthlyCacheFilePath(
            monthKey,
            account.slug,
            dataDir,
            "stripe",
            undefined,
            undefined,
            undefined,
            currency
          );
          if (fs.existsSync(filePath)) {
            try {
              const cacheContent = JSON.parse(
                fs.readFileSync(filePath, "utf-8")
              );
              if (
                cacheContent.transactions &&
                cacheContent.transactions.length > 0
              ) {
                lastTransactionTimestamp = cacheContent.transactions[0].created;
                break;
              }
            } catch (error) {
              // Continue to next month
            }
          }
        }
      }
      console.log("");
    }

    // Fetch balance
    let balance = 0;
    try {
      console.log(`  Fetching balance...`);
      const balanceData = await fetchStripeBalance(stripeSecretKey);
      balance = calculateStripeBalance(
        balanceData,
        account.currency?.toLowerCase() || "eur"
      );
      console.log(`  ✓ Balance: ${balance} ${account.currency || "EUR"}\n`);
    } catch (error: any) {
      console.error(`  ⚠ Error fetching balance:`, error.message);
    }

    return { slug: account.slug, balance, lastTransactionTimestamp };
  } catch (error) {
    console.error(
      `\n✗ Error processing Stripe account ${account.slug}:`,
      error
    );
    throw error;
  }
}

/**
 * Process Etherscan account
 */
export async function processEtherscanAccount(
  account: {
    slug: string;
    name: string;
    chain: string;
    chainId: number;
    address: string;
    token: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
    };
  },
  etherscanApiKey: string,
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data"),
  startMonth?: string,
  endMonth?: string,
  force: boolean = false
): Promise<AccountData> {
  try {
    console.log(
      `\nProcessing Etherscan account: ${account.slug} (${account.name})`
    );
    console.log(`  Chain: ${account.chain} (Chain ID: ${account.chainId})`);
    console.log(`  Address: ${account.address}`);
    console.log(`  Token: ${account.token.symbol} (${account.token.name})\n`);

    // Fetch all transactions
    const transactions = await fetchAllEtherscanTransactions(
      account,
      etherscanApiKey,
      dataDir,
      startMonth,
      endMonth
    );

    if (transactions.length === 0) {
      console.log(`No transactions found for ${account.slug}. Skipping.\n`);
      return { slug: account.slug, balance: 0, lastTransactionTimestamp: null };
    }

    // Group by month and cache (skipping existing historical months unless force is enabled)
    cacheTransactionsByMonth(
      account.slug,
      transactions,
      dataDir,
      "etherscan",
      account.address,
      account.chain,
      account.token.symbol,
      undefined,
      startMonth,
      endMonth,
      undefined,
      force
    );

    // Get last transaction timestamp
    const lastTransactionTimestamp =
      transactions.length > 0
        ? Number.parseInt(transactions[0].timeStamp) // Already sorted by most recent first
        : null;

    // Fetch balance
    let balance = 0;
    try {
      console.log(`  Fetching balance...`);
      const balanceData = await fetchTokenBalance(
        account.chainId,
        account.token.address,
        account.address,
        etherscanApiKey
      );
      balance = parseTokenBalance(balanceData.result, account.token.decimals);
      console.log(`  ✓ Balance: ${balance} ${account.token.symbol}\n`);
    } catch (error: any) {
      console.error(`  ⚠ Error fetching balance:`, error.message);
    }

    return { slug: account.slug, balance, lastTransactionTimestamp };
  } catch (error) {
    console.error(
      `\n✗ Error processing Etherscan account ${account.slug}:`,
      error
    );
    throw error;
  }
}

/**
 * Write finance cache with balances and last transaction timestamps
 */
export function writeFinanceCache(
  accountData: AccountData[],
  dataDir: string = process.env.DATA_DIR || path.join(process.cwd(), "data")
): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const financeCacheFile = path.join(dataDir, "finance.json");
    const financeData = {
      lastUpdated: Date.now(),
      accounts: accountData,
    };

    fs.writeFileSync(
      financeCacheFile,
      JSON.stringify(financeData, null, 2),
      "utf-8"
    );

    console.log(`\n✓ Cached finance data for ${accountData.length} account(s)`);
  } catch (error) {
    console.error("Error writing finance cache:", error);
    throw error;
  }
}

/**
 * Load settings from settings.json file
 */
export function loadSettings(
  settingsFile: string = path.join(process.cwd(), "src/settings", "settings.json")
): any {
  if (!fs.existsSync(settingsFile)) {
    throw new Error("settings.json not found");
  }

  return JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
}

/**
 * Main function to warm up transaction cache
 */
export async function warmupTransactionCache(
  options: TransactionCacheOptions = {}
): Promise<AccountData[]> {
  const {
    dataDir = path.join(process.cwd(), "data"),
    settingsFile = path.join(process.cwd(), "src/settings", "settings.json"),
    stripeSecretKey = process.env.STRIPE_SECRET_KEY,
    etherscanApiKey = process.env.ETHERSCAN_API_KEY,
    startMonth,
    endMonth,
    force = false,
  } = options;

  try {
    console.log("Starting transaction cache warmup...\n");

    const settings = loadSettings(settingsFile);
    const accounts = settings.finance?.accounts || [];

    if (accounts.length === 0) {
      console.log("No accounts found in settings.json");
      return [];
    }

    // Separate accounts by provider
    const stripeAccounts = accounts.filter((a: any) => a.provider === "stripe");
    const etherscanAccounts = accounts.filter(
      (a: any) => a.provider === "etherscan"
    );

    console.log(`Found ${stripeAccounts.length} Stripe account(s)`);
    console.log(`Found ${etherscanAccounts.length} Etherscan account(s)\n`);

    const accountData: AccountData[] = [];

    // Process Stripe accounts
    if (stripeAccounts.length > 0) {
      if (!stripeSecretKey) {
        console.warn(
          "⚠ Warning: STRIPE_SECRET_KEY not set, skipping Stripe accounts\n"
        );
      } else {
        for (const account of stripeAccounts) {
          const result = await processStripeAccount(
            account,
            stripeSecretKey,
            dataDir,
            startMonth,
            endMonth,
            force
          );
          accountData.push({
            slug: result.slug,
            balance: result.balance || 0,
            lastTransactionTimestamp: result.lastTransactionTimestamp || null,
          });
        }
      }
    }

    // Process Etherscan accounts
    if (etherscanAccounts.length > 0) {
      if (!etherscanApiKey) {
        console.warn(
          "⚠ Warning: ETHERSCAN_API_KEY not set, skipping Etherscan accounts\n"
        );
      } else {
        for (const account of etherscanAccounts) {
          const result = await processEtherscanAccount(
            account,
            etherscanApiKey,
            dataDir,
            startMonth,
            endMonth,
            force
          );
          accountData.push({
            slug: result.slug,
            balance: result.balance || 0,
            lastTransactionTimestamp: result.lastTransactionTimestamp || null,
          });
        }
      }
    }

    // Write finance cache with balances
    writeFinanceCache(accountData, dataDir);

    console.log("\n✓ Cache warmup completed successfully!");
    return accountData;
  } catch (error) {
    console.error("\n✗ Error during cache warmup:", error);
    throw error;
  }
}
