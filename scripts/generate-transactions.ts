/**
 * Generate aggregated transactions.json for each month
 * Combines data from Etherscan and Stripe into a single file
 * with normalized amounts and metadata support
 */

import * as fs from "fs";
import * as path from "path";
import settings from "../src/settings/settings.json";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

interface TransactionMetadata {
  collective: string;
  project: string | null;
  event: string | null;
  category: string;
  tags: string[];
  description: string;
}

interface Transaction {
  id: string;
  provider: "etherscan" | "stripe";
  chain: string | null;
  account: string;
  accountSlug: string;
  accountName: string;
  currency: string;
  value: string;
  normalizedAmount: number; // in cents
  type: "CREDIT" | "DEBIT";
  counterparty: string;
  timestamp: number;
  txHash?: string;
  stripeChargeId?: string;
  metadata: TransactionMetadata;
}

interface TransactionsFile {
  month: string;
  generatedAt: string;
  transactions: Transaction[];
}

interface CounterpartyMetadata {
  description: string;
  type: "organisation" | "individual" | null;
}

interface Counterparty {
  id: string; // chain:0xaddress or iban:$IBAN or stripe:customerId
  metadata: CounterpartyMetadata;
}

interface CounterpartiesFile {
  month: string;
  generatedAt: string;
  counterparties: Counterparty[];
}

/**
 * Calculate normalized amount in cents
 */
function normalizeAmount(value: string, decimals: number): number {
  const num = BigInt(value);
  const divisor = BigInt(10 ** decimals);
  const tokenAmount = Number(num) / Number(divisor);
  // Assuming 1 token = 1 EUR = 100 cents for EURe/EURb
  return Math.round(tokenAmount * 100);
}

/**
 * Get all month directories in the data folder
 */
function getAllMonths(): Array<{ year: string; month: string }> {
  const months: Array<{ year: string; month: string }> = [];

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
      months.push({ year, month });
    }
  }

  return months;
}

/**
 * Load existing transactions file to preserve metadata
 */
function loadExistingTransactions(
  year: string,
  month: string
): Map<string, TransactionMetadata> {
  const filePath = path.join(DATA_DIR, year, month, "transactions.json");
  const metadataMap = new Map<string, TransactionMetadata>();

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data: TransactionsFile = JSON.parse(content);
      for (const tx of data.transactions) {
        metadataMap.set(tx.id, tx.metadata);
      }
    } catch (error) {
      console.error(`Error reading existing transactions file:`, error);
    }
  }

  return metadataMap;
}

/**
 * Get default metadata
 */
function getDefaultMetadata(): TransactionMetadata {
  // collectives is an object, get first key or default to "commonshub"
  const collectivesObj = (settings.finance as any).collectives || {};
  const defaultCollective = Object.keys(collectivesObj)[0] || "commonshub";

  return {
    collective: defaultCollective,
    project: null,
    event: null,
    category: "other",
    tags: [],
    description: "",
  };
}

/**
 * Load existing counterparties file to preserve metadata
 */
function loadExistingCounterparties(
  year: string,
  month: string
): Map<string, CounterpartyMetadata> {
  const filePath = path.join(DATA_DIR, year, month, "counterparties.json");
  const metadataMap = new Map<string, CounterpartyMetadata>();

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data: CounterpartiesFile = JSON.parse(content);
      for (const cp of data.counterparties) {
        metadataMap.set(cp.id, cp.metadata);
      }
    } catch (error) {
      console.error(`Error reading existing counterparties file:`, error);
    }
  }

  return metadataMap;
}

/**
 * Get default counterparty metadata
 */
function getDefaultCounterpartyMetadata(): CounterpartyMetadata {
  return {
    description: "",
    type: null,
  };
}

/**
 * Generate transactions for a specific month
 */
async function generateTransactionsForMonth(
  year: string,
  month: string
): Promise<void> {
  console.log(`\n📅 Processing ${year}-${month}...`);

  const existingMetadata = loadExistingTransactions(year, month);
  const existingCounterpartyMetadata = loadExistingCounterparties(year, month);
  const transactions: Transaction[] = [];
  const counterpartyIds = new Set<string>();

  // Process Etherscan transactions
  const etherscanAccounts = settings.finance.accounts.filter(
    (a) => a.provider === "etherscan"
  );

  for (const account of etherscanAccounts) {
    // New structure: /:year/:month/finance/:chain/:accountSlug.:tokenSymbol.json
    const filePath = path.join(
      DATA_DIR,
      year,
      month,
      "finance",
      account.chain,
      `${account.slug}.${account.token.symbol}.json`
    );

    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      const txs = data.transactions || [];

      for (const tx of txs) {
        const id = `${account.chain}:${tx.hash}`;
        const isCredit = tx.to.toLowerCase() === account.address.toLowerCase();
        const normalizedAmount = normalizeAmount(
          tx.value,
          parseInt(tx.tokenDecimal)
        );

        const counterpartyAddress = isCredit ? tx.from : tx.to;
        const counterpartyId = `${account.chain}:${counterpartyAddress.toLowerCase()}`;

        counterpartyIds.add(counterpartyId);

        transactions.push({
          id,
          provider: "etherscan",
          chain: account.chain,
          account: account.address,
          accountSlug: account.slug,
          accountName: account.name,
          currency: tx.tokenSymbol,
          value: tx.value,
          amount: normalizedAmount, // Net amount (renamed from normalizedAmount for clarity)
          grossAmount: normalizedAmount, // For blockchain transfers, gross = net (gas fees are separate)
          normalizedAmount, // Keep for backwards compatibility
          type: isCredit ? "CREDIT" : "DEBIT",
          counterparty: counterpartyAddress,
          timestamp: parseInt(tx.timeStamp),
          txHash: tx.hash,
          metadata: existingMetadata.get(id) || getDefaultMetadata(),
        });
      }

      console.log(
        `  ✓ Processed ${txs.length} transactions from ${account.name}`
      );
    } catch (error) {
      console.error(`  ✗ Error processing ${account.name}:`, error);
    }
  }

  // Process Stripe transactions
  const stripeAccount = settings.finance.accounts.find((a) => a.provider === "stripe");
  if (stripeAccount) {
    // New structure: /:year/:month/finance/stripe/:accountId.json
    const accountIdentifier = (stripeAccount as any).accountId || stripeAccount.slug;
    const stripeFilePath = path.join(
      DATA_DIR,
      year,
      month,
      "finance",
      "stripe",
      `${accountIdentifier}.json`
    );

    if (fs.existsSync(stripeFilePath)) {
      try {
        const content = fs.readFileSync(stripeFilePath, "utf-8");
        const data = JSON.parse(content);
        const stripeTxs = data.transactions || [];

        for (const tx of stripeTxs) {
          const id = `stripe:${tx.id}`;
          const isCredit = tx.amount > 0;
          const netAmount = Math.abs(tx.amount); // Stripe amounts are already in cents (net amount after fees)
          const fee = Math.abs(tx.fee || 0); // Stripe fee in cents

          // Calculate gross amount (what the customer actually paid)
          // For credits: gross = net + fee (customer paid more, Stripe took their cut)
          // For debits: gross = net (fees are already included in the debit amount)
          const grossAmount = isCredit ? netAmount + fee : netAmount;

          // Get customer/counterparty info - prefer customer ID over description
          const counterparty = tx.source?.metadata?.to || tx.metadata?.to || tx.source?.customer || "Unknown";
          const counterpartyId = `stripe:${tx.source?.customer || tx.id}`;

          counterpartyIds.add(counterpartyId);

          // Determine collective and category from metadata
          const metadata = existingMetadata.get(id) || getDefaultMetadata();

          // Store description in metadata
          if (tx.description) {
            metadata.description = tx.description;
          }

          // Check for metadata.to (donation) or metadata.event_api_id (ticket)
          const stripeMetadata = tx.source?.metadata || tx.metadata || {};

          if (stripeMetadata.to) {
            // If there's a "to" in metadata, use it as collective and set category to "donation"
            metadata.collective = stripeMetadata.to;
            metadata.category = "donation";
          } else if (stripeMetadata.event_api_id) {
            // If there's an event_api_id, set category to "ticket"
            metadata.category = "ticket";
          } else if (tx.description && (tx.description.includes("Subscription creation") || tx.description.includes("Subscription update"))) {
            // Auto-categorize subscription transactions as membership
            metadata.category = "membership";
          }

          transactions.push({
            id,
            provider: "stripe",
            chain: null,
            account: stripeAccount.slug,
            accountSlug: stripeAccount.slug,
            accountName: stripeAccount.name,
            currency: tx.currency.toUpperCase(),
            value: tx.amount.toString(),
            amount: netAmount, // Net amount (what you receive after fees)
            grossAmount, // Gross amount (what the customer paid)
            normalizedAmount: netAmount, // Keep for backwards compatibility
            fee, // Store the fee separately for reference
            type: isCredit ? "CREDIT" : "DEBIT",
            counterparty,
            timestamp: tx.created,
            stripeChargeId: tx.source?.id,
            metadata,
          });
        }

        console.log(
          `  ✓ Processed ${stripeTxs.length} transactions from ${stripeAccount.name}`
        );
      } catch (error) {
        console.error(`  ✗ Error processing ${stripeAccount.name}:`, error);
      }
    }
  }

  // Sort by timestamp (newest first)
  transactions.sort((a, b) => b.timestamp - a.timestamp);

  // Write transactions file
  const outputFile: TransactionsFile = {
    month: `${year}-${month}`,
    generatedAt: new Date().toISOString(),
    transactions,
  };

  const outputPath = path.join(DATA_DIR, year, month, "transactions.json");
  fs.writeFileSync(outputPath, JSON.stringify(outputFile, null, 2), "utf-8");

  console.log(
    `  ✓ Generated transactions.json with ${transactions.length} transactions`
  );

  // Generate counterparties
  const counterparties: Counterparty[] = Array.from(counterpartyIds)
    .sort()
    .map((id) => ({
      id,
      metadata:
        existingCounterpartyMetadata.get(id) ||
        getDefaultCounterpartyMetadata(),
    }));

  const counterpartiesFile: CounterpartiesFile = {
    month: `${year}-${month}`,
    generatedAt: new Date().toISOString(),
    counterparties,
  };

  const counterpartiesPath = path.join(
    DATA_DIR,
    year,
    month,
    "counterparties.json"
  );
  fs.writeFileSync(
    counterpartiesPath,
    JSON.stringify(counterpartiesFile, null, 2),
    "utf-8"
  );

  console.log(
    `  ✓ Generated counterparties.json with ${counterparties.length} counterparties`
  );
}

/**
 * Generate yearly CSV file
 */
async function generateYearlyCSV(year: string): Promise<void> {
  console.log(`\n📄 Generating CSV for ${year}...`);

  const yearPath = path.join(DATA_DIR, year);
  if (!fs.existsSync(yearPath)) {
    console.log(`  ⚠️  Year directory not found: ${year}`);
    return;
  }

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  const allTransactions: Transaction[] = [];

  // Load all transactions from each month
  for (const month of monthDirs) {
    const transactionsPath = path.join(yearPath, month, "transactions.json");
    if (fs.existsSync(transactionsPath)) {
      try {
        const content = fs.readFileSync(transactionsPath, "utf-8");
        const data: TransactionsFile = JSON.parse(content);
        allTransactions.push(...data.transactions);
      } catch (error) {
        console.error(
          `  ✗ Error reading transactions for ${year}-${month}:`,
          error
        );
      }
    }
  }

  // Load Monerium orders for the year to enhance transaction data
  const moneriumOrdersByTxHash = new Map<string, any>();
  const etherscanAccounts = settings.finance.accounts.filter(
    (a) => a.provider === "etherscan"
  );

  for (const account of etherscanAccounts) {
    for (const month of monthDirs) {
      const moneriumFilePath = path.join(
        DATA_DIR,
        year,
        month,
        "private",
        "monerium",
        `${account.address?.toLowerCase()}.json`
      );

      if (fs.existsSync(moneriumFilePath)) {
        try {
          const content = fs.readFileSync(moneriumFilePath, "utf-8");
          const data = JSON.parse(content);
          const orders = data.orders || [];

          for (const order of orders) {
            if (order.meta?.txHashes) {
              for (const txHash of order.meta.txHashes) {
                moneriumOrdersByTxHash.set(txHash.toLowerCase(), order);
              }
            }
          }
        } catch (error) {
          console.error(
            `  ✗ Error reading Monerium data for ${account.slug} ${year}-${month}:`,
            error
          );
        }
      }
    }
  }

  if (allTransactions.length === 0) {
    console.log(`  ⚠️  No transactions found for ${year}`);
    return;
  }

  // Sort by timestamp (newest first)
  allTransactions.sort((a, b) => b.timestamp - a.timestamp);

  // Generate CSV content
  const headers = [
    "Date",
    "Account",
    "Type",
    "Amount (EUR)",
    "Collective",
    "Category",
    "Description",
    "Counterparty",
    "Transaction ID",
  ];

  const rows = allTransactions.map((tx) => {
    const date = new Date(tx.timestamp * 1000);
    const dateStr = date.toLocaleDateString("en-GB");
    const timeStr = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const accountName = tx.accountName ||
      settings.finance.accounts.find(
        (a) => a.address?.toLowerCase() === tx.account?.toLowerCase()
      )?.name || tx.account;
    const amount = (tx.normalizedAmount / 100).toFixed(2);
    const amountStr = tx.type === "CREDIT" ? `+${amount}` : `-${amount}`;

    // Try to get Monerium order data for better description and counterparty
    let description = tx.metadata.description || "";
    let counterpartyName = tx.counterparty;

    if (tx.txHash) {
      const moneriumOrder = moneriumOrdersByTxHash.get(tx.txHash.toLowerCase());
      if (moneriumOrder) {
        // Use Monerium counterparty name if available
        if (moneriumOrder.counterpart?.details?.name) {
          counterpartyName = moneriumOrder.counterpart.details.name;
          // Add address if available
          if (moneriumOrder.counterpart.details.address) {
            counterpartyName += ` (${moneriumOrder.counterpart.details.address})`;
          }
        }
        // Use memo as description if no description is set
        if (!description && moneriumOrder.memo) {
          description = moneriumOrder.memo;
        }
      }
    }

    return [
      `${dateStr} ${timeStr}`,
      accountName,
      tx.type === "CREDIT" ? "In" : "Out",
      amountStr,
      tx.metadata.collective,
      tx.metadata.category,
      description,
      counterpartyName,
      tx.id,
    ];
  });

  // Escape CSV cells
  const escapeCsvCell = (cell: string): string => {
    const cellStr = String(cell);
    if (
      cellStr.includes(",") ||
      cellStr.includes('"') ||
      cellStr.includes("\n")
    ) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  };

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n");

  // Write CSV file
  const csvPath = path.join(DATA_DIR, year, "transactions.csv");
  fs.writeFileSync(csvPath, csvContent, "utf-8");

  console.log(
    `  ✓ Generated transactions.csv with ${allTransactions.length} transactions`
  );
}

/**
 * Main function
 */
async function main() {
  console.log("🔄 Generating transactions.json files...\n");

  const args = process.argv.slice(2);

  if (args.length >= 2) {
    // Generate for specific month
    const [year, month] = args;
    await generateTransactionsForMonth(year, month);
    // Also generate yearly CSV for this year
    await generateYearlyCSV(year);
  } else {
    // Generate for all months
    const months = getAllMonths();

    if (months.length === 0) {
      console.log("⚠️  No month directories found in data/");
      return;
    }

    console.log(`📊 Found ${months.length} months to process`);

    for (const { year, month } of months) {
      await generateTransactionsForMonth(year, month);
    }

    // Generate yearly CSV files for each unique year
    const uniqueYears = [...new Set(months.map((m) => m.year))];
    for (const year of uniqueYears) {
      await generateYearlyCSV(year);
    }
  }

  console.log("\n✅ Done!");
}

// Run the script
main().catch((error) => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});
