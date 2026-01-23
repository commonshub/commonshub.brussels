/**
 * Transaction Fetching Tests
 * Tests that transactions can be fetched and cached in the correct directory structure
 * @jest-environment node
 */

import { describe, test, expect } from "@jest/globals";
import * as path from "path";
import * as fs from "fs";
import { warmupTransactionCache } from "@/lib/transaction-cache";
import dotenv from "dotenv";

dotenv.config();

// Skip these tests in CI when API keys are not available
const hasApiKeys = Boolean(process.env.STRIPE_SECRET_KEY || process.env.ETHERSCAN_API_KEY);

describe("Transaction Fetching Tests", () => {
  const testDataDir = path.join(process.cwd(), "tests", "data");
  const testMonth = "2025-11";

  (hasApiKeys ? test : test.skip)("fetches transactions for 2025/11 and stores in correct structure", async () => {
    console.log("\n🧪 Fetching test transactions for 2025/11");
    console.log(`📁 Test data directory: ${testDataDir}`);

    const result = await warmupTransactionCache({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      etherscanApiKey: process.env.ETHERSCAN_API_KEY,
      dataDir: testDataDir,
      startMonth: testMonth,
      endMonth: testMonth,
    });

    console.log("\n✓ Test data fetched successfully!");
    console.log(`📍 Location: ${testDataDir}/2025/11/finance/`);

    // Verify that accounts were processed
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Verify finance directory was created
    const financeDir = path.join(testDataDir, "2025", "11", "finance");
    expect(fs.existsSync(financeDir)).toBe(true);

    // Check for Stripe transactions
    const stripeFile = path.join(financeDir, "stripe", "transactions.json");
    if (process.env.STRIPE_SECRET_KEY) {
      expect(fs.existsSync(stripeFile)).toBe(true);

      const stripeData = JSON.parse(fs.readFileSync(stripeFile, "utf-8"));
      expect(stripeData).toHaveProperty("transactions");
      expect(stripeData).toHaveProperty("cachedAt");
      expect(stripeData).toHaveProperty("transactionCount");
      expect(Array.isArray(stripeData.transactions)).toBe(true);

      console.log(`\n✓ Stripe: ${stripeData.transactionCount} transactions`);
    }

    // Check for blockchain account transactions
    // Find all JSON files in the finance directory structure
    const accountFiles = findAccountFiles(financeDir);
    console.log(`✓ Found ${accountFiles.length} account file(s)`);

    accountFiles.forEach((filePath) => {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(data).toHaveProperty("transactions");
      expect(data).toHaveProperty("cachedAt");
      expect(data).toHaveProperty("transactionCount");
      expect(Array.isArray(data.transactions)).toBe(true);

      const relativePath = path.relative(financeDir, filePath);
      console.log(`  ✓ ${relativePath}: ${data.transactionCount} transactions`);
    });

    // Verify file naming follows the pattern
    accountFiles.forEach((filePath) => {
      const fileName = path.basename(filePath);
      const accountDir = path.basename(path.dirname(filePath));

      // Skip validation for transactions.json (aggregated file)
      if (fileName === "transactions.json") {
        return;
      }

      // Skip validation for Stripe account files (various formats)
      if (accountDir === "stripe") {
        expect(fileName).toMatch(/\.json$/);
        return;
      }

      const parts = fileName.replace(".json", "").split(".");

      // New structure supports multiple formats:
      // 1. Token aggregate file (e.g., celo/): CHT.json (1 part - just token symbol)
      // 2. In chain directory (e.g., gnosis/): wallet-name.token.json (2 parts)
      // 3. In wallet directory (e.g., savings/): 0xAddress.token.chain.json (3 parts)

      if (parts.length === 1) {
        // Format: TOKEN.json (token aggregate file)
        const [tokenSymbol] = parts;
        expect(tokenSymbol).toBeTruthy();
      } else if (parts.length === 2) {
        // Format: wallet-name.token.json (chain is directory name)
        const [walletName, tokenSymbol] = parts;
        expect(walletName).toBeTruthy();
        expect(tokenSymbol).toBeTruthy();
      } else if (parts.length >= 3) {
        // Format: 0xAddress.token.chain.json
        const [address, tokenSymbol, chain] = parts;
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/); // Valid Ethereum address
        expect(tokenSymbol).toBeTruthy();
        expect(chain).toBeTruthy();
      } else {
        // Invalid format
        throw new Error(`Invalid filename format: ${fileName} (${parts.length} parts)`);
      }
    });

    console.log("\n✓ All transaction files verified!");
  }, 120000); // 2 minute timeout for network requests

  test("transactions contain no sensitive data (emails, billing_details, phone)", () => {
    console.log("\n🔒 Verifying no sensitive data in transaction files");

    const financeDir = path.join(testDataDir, "2025", "11", "finance");
    const accountFiles = findAccountFiles(financeDir);

    // Email pattern - matches common email formats
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

    accountFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      const relativePath = path.relative(financeDir, filePath);

      // Check for email addresses in the raw content
      const emailMatches = content.match(emailPattern);
      if (emailMatches) {
        console.error(`❌ Found email address(es) in ${relativePath}:`, emailMatches);
      }
      expect(emailMatches).toBeNull();

      // Check for sensitive fields in the JSON structure
      const sensitiveFields = ["billing_details", "phone", "email"];
      const jsonString = JSON.stringify(data);

      sensitiveFields.forEach((field) => {
        // Check if the field name exists as a key in the JSON
        const fieldPattern = new RegExp(`"${field}"\\s*:`);
        if (fieldPattern.test(jsonString)) {
          console.error(
            `❌ Found sensitive field "${field}" in ${relativePath}`
          );
        }
        expect(fieldPattern.test(jsonString)).toBe(false);
      });

      console.log(`  ✓ ${relativePath}: No sensitive data found`);
    });

    console.log("\n✓ All transaction files are sanitized!");
  });
});

/**
 * Recursively find all JSON files in account directories
 */
function findAccountFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      files.push(...findAccountFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}
