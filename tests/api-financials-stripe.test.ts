/**
 * Test for Stripe transactions in the financials API
 * Verifies that Stripe data is correctly loaded from the new file structure
 */

import fs from "fs";
import path from "path";

describe("Financials API - Stripe Transactions", () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

  it("should have Stripe data files in the correct location", () => {
    // Check if we have any Stripe data files
    const year = "2025";
    const months = ["01", "02", "03", "04"];
    let foundFiles = 0;

    for (const month of months) {
      const stripePath = path.join(
        DATA_DIR,
        year,
        month,
        "finance",
        "stripe",
        "acct_1Nn0FaFAhaWeDyow.json"
      );

      if (fs.existsSync(stripePath)) {
        foundFiles++;

        // Verify file structure
        const content = fs.readFileSync(stripePath, "utf-8");
        const data = JSON.parse(content);

        expect(data).toHaveProperty("transactions");
        expect(Array.isArray(data.transactions)).toBe(true);

        if (data.transactions.length > 0) {
          const tx = data.transactions[0];
          expect(tx).toHaveProperty("id");
          expect(tx).toHaveProperty("created");
          expect(tx).toHaveProperty("amount");
          expect(tx).toHaveProperty("net");
          expect(tx).toHaveProperty("currency");
        }
      }
    }

    expect(foundFiles).toBeGreaterThan(0);
  });

  it("should load Stripe transactions via the API route", async () => {
    // Import the route handler
    const { GET } = await import("@/app/api/financials/route");

    // Mock the request
    const request = new Request("http://localhost:3000/api/financials?slug=stripe");

    // Call the API
    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("slug", "stripe");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("provider", "stripe");
    expect(data).toHaveProperty("balance");
    expect(data).toHaveProperty("totalInflow");
    expect(data).toHaveProperty("totalOutflow");
    expect(data).toHaveProperty("monthlyBreakdown");
    expect(data).toHaveProperty("recentTransactions");

    // Verify monthly breakdown
    expect(Array.isArray(data.monthlyBreakdown)).toBe(true);

    // Verify transactions
    expect(Array.isArray(data.recentTransactions)).toBe(true);
    if (data.recentTransactions.length > 0) {
      const tx = data.recentTransactions[0];
      expect(tx).toHaveProperty("hash");
      expect(tx).toHaveProperty("date");
      expect(tx).toHaveProperty("description");
      expect(tx).toHaveProperty("amount");
      expect(tx).toHaveProperty("net");
      expect(tx).toHaveProperty("direction");
      expect(["in", "out"]).toContain(tx.direction);

      // Verify source is a string (not an object)
      if (tx.source) {
        expect(typeof tx.source).toBe("string");
      }
    }
  });

  it("should have transactions with valid data", async () => {
    const { GET } = await import("@/app/api/financials/route");
    const request = new Request("http://localhost:3000/api/financials?slug=stripe");
    const response = await GET(request);
    const data = await response.json();

    // Should have some transactions
    expect(data.recentTransactions.length).toBeGreaterThan(0);

    // Check first transaction has valid amounts
    const firstTx = data.recentTransactions[0];
    expect(typeof firstTx.amount).toBe("number");
    expect(typeof firstTx.net).toBe("number");
    expect(typeof firstTx.fee).toBe("number");

    // Monthly breakdown should have data
    expect(data.monthlyBreakdown.length).toBeGreaterThan(0);

    const firstMonth = data.monthlyBreakdown[0];
    expect(firstMonth).toHaveProperty("month");
    expect(firstMonth).toHaveProperty("inflow");
    expect(firstMonth).toHaveProperty("outflow");
    expect(firstMonth).toHaveProperty("net");
    expect(typeof firstMonth.inflow).toBe("number");
    expect(typeof firstMonth.outflow).toBe("number");
  });
});
