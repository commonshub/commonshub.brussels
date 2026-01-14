import { notFound } from "next/navigation";
import * as fs from "fs";
import * as path from "path";
import { isAdmin } from "@/lib/admin-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";

interface PageProps {
  params: Promise<{
    year: string;
  }>;
}

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
  id: string;
  metadata: CounterpartyMetadata;
}

interface CounterpartiesFile {
  month: string;
  generatedAt: string;
  counterparties: Counterparty[];
}

/**
 * Load all transactions from consolidated files for a year
 */
async function loadAllYearlyTransactions(year: string): Promise<Transaction[]> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const yearPath = path.join(dataDir, year);

  if (!fs.existsSync(yearPath)) {
    return [];
  }

  const allTransactions: Transaction[] = [];

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const month of monthDirs) {
    const filePath = path.join(dataDir, year, month, "transactions.json");

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const data: TransactionsFile = JSON.parse(fileContent);
        allTransactions.push(...data.transactions);
      } catch (error) {
        console.error(`Error reading transaction file for ${year}-${month}:`, error);
      }
    }
  }

  return allTransactions;
}

/**
 * Load counterparty metadata from all months
 */
async function loadYearlyCounterpartyMetadata(year: string): Promise<Map<string, CounterpartyMetadata>> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const yearPath = path.join(dataDir, year);
  const metadataMap = new Map<string, CounterpartyMetadata>();

  if (!fs.existsSync(yearPath)) {
    return metadataMap;
  }

  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const month of monthDirs) {
    const filePath = path.join(dataDir, year, month, "counterparties.json");

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data: CounterpartiesFile = JSON.parse(content);

        for (const cp of data.counterparties) {
          metadataMap.set(cp.id, cp.metadata);
        }
      } catch (error) {
        console.error(`Error reading counterparty metadata for ${year}-${month}:`, error);
      }
    }
  }

  return metadataMap;
}

/**
 * Load Monerium orders from all months
 */
async function loadYearlyMoneriumOrders(year: string): Promise<Map<string, any>> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const yearPath = path.join(dataDir, year);
  const ordersMap = new Map<string, any>();

  if (!fs.existsSync(yearPath)) {
    return ordersMap;
  }

  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const month of monthDirs) {
    const moneriumDir = path.join(dataDir, year, month, "private", "monerium");

    if (fs.existsSync(moneriumDir)) {
      const files = fs.readdirSync(moneriumDir);

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const filePath = path.join(moneriumDir, file);
            const content = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(content);

            if (data.orders) {
              for (const order of data.orders) {
                if (order.meta?.txHashes) {
                  for (const txHash of order.meta.txHashes) {
                    ordersMap.set(txHash.toLowerCase(), order);
                  }
                }
              }
            }
          } catch (error) {
            console.error(`Error reading Monerium file ${file}:`, error);
          }
        }
      }
    }
  }

  return ordersMap;
}

export default async function YearlyTransactionsPage({ params }: PageProps) {
  const { year } = await params;

  // Load all transactions for the year
  const transactions = await loadAllYearlyTransactions(year);

  if (transactions.length === 0) {
    notFound();
  }

  // Check if user is admin
  const userIsAdmin = await isAdmin();

  // Load counterparty metadata and Monerium orders
  const counterpartyMetadataMap = await loadYearlyCounterpartyMetadata(year);
  const moneriumOrdersMap = await loadYearlyMoneriumOrders(year);

  // Augment transactions with counterparty metadata and Monerium data
  const augmentedTransactions = transactions.map((tx) => {
    const counterpartyId = tx.provider === "stripe"
      ? `stripe:${tx.counterparty}`
      : `${tx.chain}:${tx.counterparty.toLowerCase()}`;
    const counterpartyMetadata = counterpartyMetadataMap.get(counterpartyId);

    // Get Monerium order if available
    const moneriumOrder = tx.txHash
      ? moneriumOrdersMap.get(tx.txHash.toLowerCase())
      : undefined;

    return {
      ...tx,
      transactionId: tx.id,
      counterpartyId,
      counterpartyMetadata,
      moneriumOrder,
      // Add TokenTransfer-like fields for compatibility
      hash: tx.txHash,
      timeStamp: tx.timestamp.toString(),
      from: tx.type === "DEBIT" ? tx.account : tx.counterparty,
      to: tx.type === "CREDIT" ? tx.account : tx.counterparty,
      transactionMetadata: tx.metadata,
    };
  });

  // Sort transactions by timestamp (newest first)
  augmentedTransactions.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          All Transactions {year}
        </h1>
        <p className="text-muted-foreground">
          {augmentedTransactions.length} transactions across all accounts
        </p>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Transactions</CardTitle>
          <CardDescription>All transactions for {year}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FinanceTransactionTable
            transactions={augmentedTransactions}
            accountAddress=""
            accountName="All Accounts"
            tokenSymbol="EUR"
            tokenDecimals={2}
            chain="gnosis"
            isAdmin={userIsAdmin}
            showAccountColumn={true}
            showExportButton={true}
            useNormalizedAmount={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
