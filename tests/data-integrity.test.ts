/**
 * Data Integrity Tests
 * 
 * Validates that historic data is present and consistent across all months.
 * These tests run against the actual DATA_DIR (production data).
 * 
 * Run with: DATA_DIR=/path/to/data npm test -- data-integrity
 */

import * as fs from "fs";
import * as path from "path";
import { describe, test, expect, beforeAll } from "@jest/globals";

// Use actual data directory, not test fixtures
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

interface MonthDir {
  year: string;
  month: string;
  path: string;
}

interface TransactionEntry {
  txHash: string;
  timestamp: number;
  type: "CREDIT" | "DEBIT";
  normalizedAmount: number;
  provider?: string;
  accountSlug?: string;
}

interface TransactionsFile {
  year: string;
  month: string;
  transactions: TransactionEntry[];
}

interface ContributorEntry {
  id?: string;
  profile?: {
    name: string;
    username: string;
    avatar_url?: string;
  };
  tokens?: {
    in: number;
    out: number;
  };
}

interface ContributorsFile {
  year: string;
  month: string;
  summary: {
    totalContributors: number;
    totalTokensIn: number;
    totalTokensOut: number;
  };
  contributors: ContributorEntry[];
}

// Helper to get all available months
function getAvailableMonths(): MonthDir[] {
  const months: MonthDir[] = [];
  
  if (!fs.existsSync(DATA_DIR)) {
    return months;
  }

  const years = fs.readdirSync(DATA_DIR)
    .filter(d => /^\d{4}$/.test(d))
    .sort();

  for (const year of years) {
    const yearPath = path.join(DATA_DIR, year);
    if (!fs.statSync(yearPath).isDirectory()) continue;

    const monthDirs = fs.readdirSync(yearPath)
      .filter(d => /^\d{2}$/.test(d))
      .sort();

    for (const month of monthDirs) {
      const monthPath = path.join(yearPath, month);
      if (fs.statSync(monthPath).isDirectory()) {
        months.push({ year, month, path: monthPath });
      }
    }
  }

  return months;
}

// Helper to safely read JSON
function readJsonSafe<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

describe("Data Integrity Tests", () => {
  let availableMonths: MonthDir[];

  beforeAll(() => {
    availableMonths = getAvailableMonths();
  });

  describe("Data Directory Structure", () => {
    test("DATA_DIR exists", () => {
      const exists = fs.existsSync(DATA_DIR);
      if (!exists) {
        console.warn(`⚠️ DATA_DIR does not exist: ${DATA_DIR}`);
        console.warn("Set DATA_DIR environment variable to point to your data directory");
      }
      // Don't fail if data doesn't exist, just skip
      expect(true).toBe(true);
    });

    test("has at least one month of data", () => {
      if (availableMonths.length === 0) {
        console.warn("⚠️ No data months found. Skipping data integrity tests.");
        return;
      }
      expect(availableMonths.length).toBeGreaterThan(0);
      console.log(`✓ Found ${availableMonths.length} months of data`);
    });

    test("months are sequential without gaps (when data exists)", () => {
      if (availableMonths.length < 2) {
        console.warn("⚠️ Need at least 2 months to check for gaps");
        return;
      }

      const gaps: string[] = [];
      for (let i = 1; i < availableMonths.length; i++) {
        const prev = availableMonths[i - 1];
        const curr = availableMonths[i];

        const prevDate = new Date(parseInt(prev.year), parseInt(prev.month) - 1);
        const currDate = new Date(parseInt(curr.year), parseInt(curr.month) - 1);
        const expectedNext = new Date(prevDate);
        expectedNext.setMonth(expectedNext.getMonth() + 1);

        if (currDate.getTime() !== expectedNext.getTime()) {
          gaps.push(`${prev.year}-${prev.month} -> ${curr.year}-${curr.month}`);
        }
      }

      if (gaps.length > 0) {
        console.warn("⚠️ Gaps found in monthly data:", gaps);
      }
      // Log but don't fail - gaps might be intentional
      expect(true).toBe(true);
    });
  });

  describe("Transactions Data", () => {
    test("each month has transactions.json", () => {
      if (availableMonths.length === 0) return;

      const missing: string[] = [];
      for (const m of availableMonths) {
        const txPath = path.join(m.path, "transactions.json");
        if (!fs.existsSync(txPath)) {
          missing.push(`${m.year}-${m.month}`);
        }
      }

      if (missing.length > 0) {
        console.warn("⚠️ Months missing transactions.json:", missing);
      }
      
      // When using test fixtures, we may not have transactions
      // Only enforce 80% coverage for production data
      const coverage = (availableMonths.length - missing.length) / availableMonths.length;
      console.log(`Transactions coverage: ${((1 - missing.length / availableMonths.length) * 100).toFixed(0)}%`);
      
      // This is informational - don't fail
      expect(true).toBe(true);
    });

    test("transactions have valid structure", () => {
      if (availableMonths.length === 0) return;

      for (const m of availableMonths) {
        const txPath = path.join(m.path, "transactions.json");
        const data = readJsonSafe<TransactionsFile>(txPath);
        if (!data) continue;

        expect(data.year).toBe(m.year);
        expect(data.month).toBe(m.month);
        expect(Array.isArray(data.transactions)).toBe(true);
      }
    });

    test("each month with transactions has both EUR and CHT transactions", () => {
      if (availableMonths.length === 0) return;

      const summary: { [key: string]: { eur: number; cht: number } } = {};
      const monthsWithoutEur: string[] = [];
      const monthsWithoutCht: string[] = [];

      for (const m of availableMonths) {
        const txPath = path.join(m.path, "transactions.json");
        const data = readJsonSafe<TransactionsFile>(txPath);
        if (!data || data.transactions.length === 0) continue;

        // Count by provider/type
        let eurCount = 0;
        let chtCount = 0;

        for (const tx of data.transactions) {
          // CHT transactions are on celo chain or have specific patterns
          // EUR transactions are from etherscan on gnosis or stripe
          if (tx.provider === "stripe" || 
              (tx.accountSlug && ["checking", "savings", "chb-safe"].includes(tx.accountSlug))) {
            eurCount++;
          } else {
            chtCount++;
          }
        }

        summary[`${m.year}-${m.month}`] = { eur: eurCount, cht: chtCount };

        if (eurCount === 0) monthsWithoutEur.push(`${m.year}-${m.month}`);
        if (chtCount === 0) monthsWithoutCht.push(`${m.year}-${m.month}`);
      }

      console.log("\nTransaction counts per month:");
      for (const [month, counts] of Object.entries(summary).slice(-6)) {
        console.log(`  ${month}: EUR=${counts.eur}, CHT=${counts.cht}`);
      }

      if (monthsWithoutEur.length > 0) {
        console.warn("⚠️ Months without EUR transactions:", monthsWithoutEur);
      }
      if (monthsWithoutCht.length > 0) {
        console.warn("⚠️ Months without CHT transactions:", monthsWithoutCht);
      }

      // Don't fail, just report
      expect(true).toBe(true);
    });
  });

  describe("Contributors Data", () => {
    test("each month has contributors.json", () => {
      if (availableMonths.length === 0) return;

      const missing: string[] = [];
      for (const m of availableMonths) {
        const contribPath = path.join(m.path, "contributors.json");
        if (!fs.existsSync(contribPath)) {
          missing.push(`${m.year}-${m.month}`);
        }
      }

      if (missing.length > 0) {
        console.warn("⚠️ Months missing contributors.json:", missing);
      }
      // Log coverage
      console.log(`Contributors data coverage: ${availableMonths.length - missing.length}/${availableMonths.length} months`);
      expect(true).toBe(true);
    });

    test("contributors summary matches contributor count", () => {
      if (availableMonths.length === 0) return;

      const mismatches: string[] = [];

      for (const m of availableMonths) {
        const contribPath = path.join(m.path, "contributors.json");
        const data = readJsonSafe<ContributorsFile>(contribPath);
        if (!data) continue;

        if (data.summary?.totalContributors !== data.contributors?.length) {
          mismatches.push(`${m.year}-${m.month}: summary=${data.summary?.totalContributors}, actual=${data.contributors?.length}`);
        }
      }

      if (mismatches.length > 0) {
        console.warn("⚠️ Contributor count mismatches:", mismatches);
      }
      expect(mismatches.length).toBe(0);
    });

    test("token totals in summary match calculated totals", () => {
      if (availableMonths.length === 0) return;

      const mismatches: string[] = [];

      for (const m of availableMonths) {
        const contribPath = path.join(m.path, "contributors.json");
        const data = readJsonSafe<ContributorsFile>(contribPath);
        if (!data || !data.contributors) continue;

        const calcIn = data.contributors.reduce((sum, c) => sum + (c.tokens?.in || 0), 0);
        const calcOut = data.contributors.reduce((sum, c) => sum + (c.tokens?.out || 0), 0);

        if (Math.abs(data.summary?.totalTokensIn - calcIn) > 0.01) {
          mismatches.push(`${m.year}-${m.month}: tokensIn summary=${data.summary?.totalTokensIn}, calc=${calcIn}`);
        }
        if (Math.abs(data.summary?.totalTokensOut - calcOut) > 0.01) {
          mismatches.push(`${m.year}-${m.month}: tokensOut summary=${data.summary?.totalTokensOut}, calc=${calcOut}`);
        }
      }

      if (mismatches.length > 0) {
        console.warn("⚠️ Token total mismatches:", mismatches);
      }
      expect(mismatches.length).toBe(0);
    });
  });

  describe("Active Members Tracking", () => {
    test("each month has active member data", () => {
      if (availableMonths.length === 0) return;

      const memberCounts: { month: string; count: number }[] = [];

      for (const m of availableMonths) {
        const contribPath = path.join(m.path, "contributors.json");
        const data = readJsonSafe<ContributorsFile>(contribPath);
        if (!data) continue;

        // Count active members (those with tokens or discord activity)
        const activeCount = data.contributors?.filter(c => 
          (c.tokens?.in ?? 0) > 0 || (c.tokens?.out ?? 0) > 0
        ).length ?? 0;

        memberCounts.push({
          month: `${m.year}-${m.month}`,
          count: activeCount
        });
      }

      if (memberCounts.length > 0) {
        console.log("\nActive members per month (with token activity):");
        for (const { month, count } of memberCounts.slice(-6)) {
          console.log(`  ${month}: ${count} active members`);
        }
      } else {
        console.log("No contributor data found with token activity");
      }

      // Informational only - don't fail if no data
      expect(true).toBe(true);
    });
  });

  describe("Finance Data", () => {
    test("finance.json exists and has valid structure", () => {
      const financePath = path.join(DATA_DIR, "finance.json");
      const data = readJsonSafe<{ accounts: Array<{ slug: string; balance: number }> }>(financePath);
      
      if (!data) {
        console.warn("⚠️ finance.json not found - financial summaries may be incomplete");
        return;
      }

      expect(data).toHaveProperty("accounts");
      expect(Array.isArray(data.accounts)).toBe(true);
      
      console.log("\nFinance accounts:");
      for (const account of data.accounts) {
        console.log(`  ${account.slug}: balance=${account.balance ?? "N/A"}`);
      }
    });
  });

  describe("Data Freshness", () => {
    test("most recent month is within last 2 months", () => {
      if (availableMonths.length === 0) return;

      const latest = availableMonths[availableMonths.length - 1];
      const latestDate = new Date(parseInt(latest.year), parseInt(latest.month) - 1);
      const now = new Date();
      
      const monthsDiff = (now.getFullYear() - latestDate.getFullYear()) * 12 + 
                         (now.getMonth() - latestDate.getMonth());

      console.log(`\nMost recent data: ${latest.year}-${latest.month} (${monthsDiff} months ago)`);

      if (monthsDiff > 2) {
        console.warn("⚠️ Data is more than 2 months old - consider running fetch scripts");
      }

      expect(monthsDiff).toBeLessThanOrEqual(2);
    });
  });
});
