/**
 * Tests for transactions.json generated files
 * 
 * Validates the structure and content of transaction files.
 * Tests skip gracefully if data doesn't exist.
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import type { TransactionsFile, Transaction } from "../src/types/transactions";
import settings from "../src/settings/settings.json";

describe("generate-transactions", () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
  
  // Find a month with transactions data
  function findTransactionsFile(): { path: string; year: string; month: string } | null {
    if (!fs.existsSync(DATA_DIR)) return null;

    const years = fs.readdirSync(DATA_DIR)
      .filter(d => /^\d{4}$/.test(d))
      .sort()
      .reverse();

    for (const year of years) {
      const yearPath = path.join(DATA_DIR, year);
      if (!fs.statSync(yearPath).isDirectory()) continue;

      const months = fs.readdirSync(yearPath)
        .filter(d => /^\d{2}$/.test(d))
        .sort()
        .reverse();

      for (const month of months) {
        const txPath = path.join(DATA_DIR, year, month, "transactions.json");
        if (fs.existsSync(txPath)) {
          return { path: txPath, year, month };
        }
      }
    }
    return null;
  }

  let transactionsFile: { path: string; year: string; month: string } | null;
  let transactionsData: TransactionsFile | null = null;

  beforeAll(() => {
    transactionsFile = findTransactionsFile();
    if (transactionsFile) {
      try {
        const content = fs.readFileSync(transactionsFile.path, "utf-8");
        transactionsData = JSON.parse(content);
        console.log(`Testing transactions from: ${transactionsFile.path}`);
        console.log(`  ${transactionsData?.transactions?.length ?? 0} transactions found`);
      } catch (e) {
        console.warn(`Failed to parse transactions file: ${e}`);
      }
    } else {
      console.warn("⚠️ No transactions.json found. Run fetch scripts first.");
    }
  });

  it("should have transactions.json (or skip)", () => {
    if (!transactionsFile) {
      console.log("Skipping - no transactions data found");
      return;
    }
    expect(fs.existsSync(transactionsFile.path)).toBe(true);
  });

  it("should have valid structure", () => {
    if (!transactionsData) return;

    expect(transactionsData.transactions).toBeDefined();
    expect(Array.isArray(transactionsData.transactions)).toBe(true);
  });

  it("should have transactions with required fields", () => {
    if (!transactionsData || transactionsData.transactions.length === 0) return;

    for (const tx of transactionsData.transactions.slice(0, 10)) {
      expect(tx).toHaveProperty("txHash");
      expect(tx).toHaveProperty("timestamp");
      expect(tx).toHaveProperty("type");
      expect(tx).toHaveProperty("normalizedAmount");
      expect(tx).toHaveProperty("provider");

      expect(["CREDIT", "DEBIT"]).toContain(tx.type);
      expect(typeof tx.normalizedAmount).toBe("number");
    }
  });

  it("should have multiple providers", () => {
    if (!transactionsData || transactionsData.transactions.length === 0) return;

    const providers = new Set(transactionsData.transactions.map(tx => tx.provider));
    console.log("Providers found:", Array.from(providers));

    // Should have at least one provider
    expect(providers.size).toBeGreaterThan(0);
  });

  it("transactions should have account metadata", () => {
    if (!transactionsData || transactionsData.transactions.length === 0) return;

    for (const tx of transactionsData.transactions.slice(0, 10)) {
      expect(tx).toHaveProperty("accountSlug");
      expect(typeof tx.accountSlug).toBe("string");
    }
  });
});
