/**
 * Tests for report calculation functions
 * 
 * These tests validate the calculation logic using available data.
 * Tests are skipped gracefully if required data doesn't exist.
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import path from "path";
import fs from "fs";

// Set DATA_DIR before imports
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
process.env.DATA_DIR = DATA_DIR;

import { calculateMonthlyFinancials } from "../src/lib/reports";

// Find available months with transactions data
function getAvailableMonths(): { year: string; month: string }[] {
  const months: { year: string; month: string }[] = [];
  
  if (!fs.existsSync(DATA_DIR)) return months;

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
      const txPath = path.join(DATA_DIR, year, month, "transactions.json");
      if (fs.existsSync(txPath)) {
        months.push({ year, month });
      }
    }
  }

  return months;
}

describe("Report calculations", () => {
  let availableMonths: { year: string; month: string }[];

  beforeAll(() => {
    availableMonths = getAvailableMonths();
    if (availableMonths.length === 0) {
      console.warn("⚠️ No transaction data found. Skipping report calculation tests.");
      console.warn(`   DATA_DIR: ${DATA_DIR}`);
    } else {
      console.log(`Found ${availableMonths.length} months with transaction data`);
    }
  });

  describe("Monthly financials calculation", () => {
    it("calculates financials for available months", () => {
      if (availableMonths.length === 0) return;

      // Test the most recent month
      const latest = availableMonths[availableMonths.length - 1];
      const financials = calculateMonthlyFinancials(latest.year, latest.month);

      console.log(`\n${latest.year}-${latest.month} Financials:`);
      console.log(`  Income: €${financials.income.toFixed(2)}`);
      console.log(`  Expenses: €${financials.expenses.toFixed(2)}`);
      console.log(`  Net: €${financials.net.toFixed(2)}`);
      console.log(`  Tokens minted: ${financials.tokens.minted.toFixed(2)}`);
      console.log(`  Tokens burnt: ${financials.tokens.burnt.toFixed(2)}`);
      console.log(`  Token transactions: ${financials.tokens.transactionCount}`);

      // Verify structure
      expect(financials).toHaveProperty("income");
      expect(financials).toHaveProperty("expenses");
      expect(financials).toHaveProperty("net");
      expect(financials).toHaveProperty("tokens");
      expect(financials.tokens).toHaveProperty("minted");
      expect(financials.tokens).toHaveProperty("burnt");
      expect(financials.tokens).toHaveProperty("net");
      expect(financials.tokens).toHaveProperty("transactionCount");
    });

    it("has correct net calculation", () => {
      if (availableMonths.length === 0) return;

      const latest = availableMonths[availableMonths.length - 1];
      const financials = calculateMonthlyFinancials(latest.year, latest.month);

      // Net should equal income - expenses
      expect(financials.net).toBeCloseTo(
        financials.income - financials.expenses,
        2
      );

      // Token net should equal minted - burnt
      expect(financials.tokens.net).toBeCloseTo(
        financials.tokens.minted - financials.tokens.burnt,
        2
      );
    });

    it("returns non-negative values", () => {
      if (availableMonths.length === 0) return;

      for (const { year, month } of availableMonths.slice(-3)) {
        const financials = calculateMonthlyFinancials(year, month);
        
        expect(financials.income).toBeGreaterThanOrEqual(0);
        expect(financials.expenses).toBeGreaterThanOrEqual(0);
        expect(financials.tokens.minted).toBeGreaterThanOrEqual(0);
        expect(financials.tokens.burnt).toBeGreaterThanOrEqual(0);
        expect(financials.tokens.transactionCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Token metrics", () => {
    it("tracks active accounts", () => {
      if (availableMonths.length === 0) return;

      const latest = availableMonths[availableMonths.length - 1];
      const financials = calculateMonthlyFinancials(latest.year, latest.month);

      expect(financials.tokens).toHaveProperty("activeAccounts");
      if (financials.tokens.transactionCount > 0) {
        expect(financials.tokens.activeAccounts).toBeGreaterThan(0);
      }
    });
  });

  describe("Historical consistency", () => {
    it("all months have valid financials", () => {
      if (availableMonths.length === 0) return;

      const errors: string[] = [];

      for (const { year, month } of availableMonths) {
        try {
          const financials = calculateMonthlyFinancials(year, month);
          
          if (typeof financials.income !== "number" || isNaN(financials.income)) {
            errors.push(`${year}-${month}: invalid income`);
          }
          if (typeof financials.expenses !== "number" || isNaN(financials.expenses)) {
            errors.push(`${year}-${month}: invalid expenses`);
          }
        } catch (e) {
          errors.push(`${year}-${month}: ${e}`);
        }
      }

      if (errors.length > 0) {
        console.warn("Calculation errors:", errors);
      }
      expect(errors.length).toBe(0);
    });
  });
});
