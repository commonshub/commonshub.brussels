import { describe, it, expect } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import type { TransactionsFile, Transaction } from "../src/types/transactions";
import settings from "../src/settings/settings.json";

describe("generate-transactions", () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
  const TEST_YEAR = "2025";
  const TEST_MONTH = "11";

  it("should generate transactions.json with all accounts", () => {
    const transactionsPath = path.join(
      DATA_DIR,
      TEST_YEAR,
      TEST_MONTH,
      "transactions.json"
    );

    expect(fs.existsSync(transactionsPath)).toBe(true);

    const content = fs.readFileSync(transactionsPath, "utf-8");
    const data: TransactionsFile = JSON.parse(content);

    expect(data.transactions).toBeDefined();
    expect(Array.isArray(data.transactions)).toBe(true);
    expect(data.transactions.length).toBeGreaterThan(0);

    // Get all account providers from settings
    const accountProviders = new Set(
      settings.finance.accounts.map((a) => a.provider)
    );

    // Get unique providers from transactions
    const transactionProviders = new Set(
      data.transactions.map((tx: any) => tx.provider)
    );

    console.log("\n📊 Account Providers in Settings:", Array.from(accountProviders));
    console.log("📊 Providers in Transactions:", Array.from(transactionProviders));
    console.log("📊 Total Transactions:", data.transactions.length);

    // Count transactions by provider
    const txCountByProvider: Record<string, number> = {};
    data.transactions.forEach((tx: any) => {
      txCountByProvider[tx.provider] = (txCountByProvider[tx.provider] || 0) + 1;
    });
    console.log("📊 Transactions by Provider:", txCountByProvider);

    // Verify each provider from settings has transactions
    accountProviders.forEach((provider) => {
      expect(transactionProviders.has(provider)).toBe(true);
      if (!transactionProviders.has(provider)) {
        console.error(`❌ Missing transactions from ${provider} account`);
      }
    });
  });

  it("should calculate normalizedAmount correctly for each token", () => {
    const transactionsPath = path.join(
      DATA_DIR,
      TEST_YEAR,
      TEST_MONTH,
      "transactions.json"
    );

    const content = fs.readFileSync(transactionsPath, "utf-8");
    const data = JSON.parse(content);

    // Group transactions by currency and check calculations
    const currencyExamples: Record<string, any[]> = {};
    data.transactions.forEach((tx: any) => {
      if (!currencyExamples[tx.currency]) {
        currencyExamples[tx.currency] = [];
      }
      if (currencyExamples[tx.currency].length < 3) {
        currencyExamples[tx.currency].push(tx);
      }
    });

    console.log("\n💰 Testing normalized amounts for each currency:\n");

    Object.entries(currencyExamples).forEach(([currency, txs]) => {
      console.log(`\n${currency}:`);

      txs.forEach((tx) => {
        // For etherscan transactions, we need to find the token decimals
        if (tx.provider === "etherscan") {
          const account = settings.finance.accounts.find(
            (a) => a.address?.toLowerCase() === tx.account?.toLowerCase()
          );

          if (account && account.token) {
            const decimals = account.token.decimals;
            const value = BigInt(tx.value);
            const divisor = BigInt(10 ** decimals);
            const tokenAmount = Number(value) / Number(divisor);
            const expectedNormalized = Math.round(tokenAmount * 100);

            console.log(`  Transaction ${tx.id.substring(0, 20)}...`);
            console.log(`    Value: ${tx.value}`);
            console.log(`    Decimals: ${decimals}`);
            console.log(`    Token Amount: ${tokenAmount.toFixed(decimals)} ${currency}`);
            console.log(`    Expected (cents): ${expectedNormalized}`);
            console.log(`    Actual (cents): ${tx.normalizedAmount}`);

            expect(tx.normalizedAmount).toBe(expectedNormalized);
          }
        } else if (tx.provider === "stripe") {
          // Stripe amounts are already in cents
          const expectedNormalized = Math.abs(parseInt(tx.value));

          console.log(`  Stripe Transaction ${tx.id.substring(0, 30)}...`);
          console.log(`    Value: ${tx.value}`);
          console.log(`    Expected (cents): ${expectedNormalized}`);
          console.log(`    Actual (cents): ${tx.normalizedAmount}`);

          expect(tx.normalizedAmount).toBe(expectedNormalized);
        }
      });
    });
  });

  it("should have correct account metadata", () => {
    const transactionsPath = path.join(
      DATA_DIR,
      TEST_YEAR,
      TEST_MONTH,
      "transactions.json"
    );

    const content = fs.readFileSync(transactionsPath, "utf-8");
    const data = JSON.parse(content);

    console.log("\n🏦 Checking account metadata:\n");

    data.transactions.forEach((tx: any) => {
      expect(tx.accountSlug).toBeDefined();
      expect(tx.accountName).toBeDefined();
      expect(typeof tx.accountSlug).toBe("string");
      expect(typeof tx.accountName).toBe("string");

      // Find the account in settings
      const account = settings.finance.accounts.find(
        (a) => a.slug === tx.accountSlug
      );

      if (account) {
        expect(tx.accountName).toBe(account.name);
      }
    });

    console.log("✅ All transactions have correct account metadata");
  });
});
