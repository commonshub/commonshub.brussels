import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { isAdmin } from "@/lib/admin-check";

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
  provider: string;
  chain: string | null;
  account: string;
  currency: string;
  value: string;
  normalizedAmount: number;
  type: string;
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

/**
 * Parse transaction ID to extract year/month
 * ID format: chain:txHash or stripe:chargeId
 */
function parseTransactionId(id: string): { year: string; month: string } | null {
  // Transaction ID is in format: chain:txHash or stripe:chargeId
  // We need to find the transaction in the data directory
  // For now, we'll need to search through year/month directories
  return null; // Will be determined by searching through files
}

/**
 * Find transaction file by searching through year/month directories
 */
function findTransactionFile(id: string): string | null {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

  if (!fs.existsSync(dataDir)) {
    return null;
  }

  // Get all year directories
  const yearDirs = fs
    .readdirSync(dataDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort()
    .reverse(); // Start with most recent year

  for (const year of yearDirs) {
    const yearPath = path.join(dataDir, year);
    const monthDirs = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort()
      .reverse(); // Start with most recent month

    for (const month of monthDirs) {
      const filePath = path.join(dataDir, year, month, "transactions.json");
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const data: TransactionsFile = JSON.parse(content);

          // Check if transaction exists in this file
          if (data.transactions.some(tx => tx.id === id)) {
            return filePath;
          }
        } catch (error) {
          console.error(`Error reading ${filePath}:`, error);
        }
      }
    }
  }

  return null;
}

/**
 * PATCH /api/transactions/[id]
 * Update transaction metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin permission
  const userIsAdmin = await isAdmin();
  if (!userIsAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // Parse request body
  let metadata: Partial<TransactionMetadata>;
  try {
    metadata = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find the transaction file
  const filePath = findTransactionFile(decodedId);
  if (!filePath) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  try {
    // Read the file
    const content = fs.readFileSync(filePath, "utf-8");
    const data: TransactionsFile = JSON.parse(content);

    // Find and update the transaction
    const txIndex = data.transactions.findIndex(tx => tx.id === decodedId);
    if (txIndex === -1) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Update metadata
    data.transactions[txIndex].metadata = {
      ...data.transactions[txIndex].metadata,
      ...metadata,
    };

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      transaction: data.transactions[txIndex],
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions/[id]
 * Get transaction details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  // Find the transaction file
  const filePath = findTransactionFile(decodedId);
  if (!filePath) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  try {
    // Read the file
    const content = fs.readFileSync(filePath, "utf-8");
    const data: TransactionsFile = JSON.parse(content);

    // Find the transaction
    const transaction = data.transactions.find(tx => tx.id === decodedId);
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Error reading transaction:", error);
    return NextResponse.json(
      { error: "Failed to read transaction" },
      { status: 500 }
    );
  }
}
