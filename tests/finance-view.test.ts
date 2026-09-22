/**
 * @jest-environment node
 */
import { describe, expect, test } from "@jest/globals";
import { counterpartBreakdown, flowsByMonth, formatMoney, positionCounterparts, sumFlows, txAmount } from "@/lib/finance-view";
import type { AugmentedTransaction } from "@/lib/transactions";

const tx = (over: Partial<AugmentedTransaction>): AugmentedTransaction =>
  ({
    id: "stripe:x",
    provider: "stripe",
    chain: null,
    accountId: "stripe:acct_1",
    accountSlug: "stripe",
    accountName: "Stripe",
    counterpartyId: null,
    currency: "EUR",
    value: "0",
    amount: 10,
    netAmount: 10,
    grossAmount: 10,
    normalizedAmount: 10,
    fee: 0,
    type: "CREDIT",
    rawType: "CREDIT",
    timestamp: 1_756_000_000, // 2025-08-24
    metadata: {},
    transactionId: "stripe:x",
    transactionUri: "stripe:x",
    transactionMetadata: {},
    timeStamp: "1756000000",
    ...over,
  }) as AugmentedTransaction;

describe("finance view", () => {
  test("sums decoded amounts by direction", () => {
    const flow = sumFlows([tx({ amount: 12.5 }), tx({ amount: -3, type: "DEBIT" })]);
    expect(flow).toEqual({ incoming: 12.5, outgoing: 3, count: 2 });
    expect(txAmount(tx({ amount: -3 }))).toBe(3);
  });

  test("groups by month, newest first", () => {
    const rows = flowsByMonth([tx({ timestamp: 1_756_000_000 }), tx({ timestamp: 1_751_000_000 })]);
    expect(rows.map(([k]) => k)).toEqual(["2025-08", "2025-06"]);
  });

  test("names counterparties only when the tier does, and skips internal rows", () => {
    const rows = [
      tx({ counterparty: "ACME", amount: 100 }),
      tx({ counterparty: "ACME", amount: 5, type: "DEBIT" }),
      tx({ counterparty: "Landlord", amount: 900, type: "DEBIT" }),
      tx({ counterparty: "0x0000000000000000000000000000000000000000", amount: 1 }),
      tx({ counterparty: "Us", rawType: "INTERNAL", amount: 50 }),
      tx({ counterpartyMetadata: { name: "Metadata Named" }, amount: 7 }),
    ];
    const { customers, vendors } = counterpartBreakdown(rows);
    expect(customers.map((c) => c.name)).toEqual(["ACME", "Metadata Named"]);
    expect(customers[0]).toMatchObject({ totalIncoming: 100, totalOutgoing: 5, transactionCount: 2 });
    expect(vendors.map((v) => v.name)).toEqual(["Landlord"]);
    // The public tier has no names at all → nothing to show.
    expect(counterpartBreakdown([tx({ amount: 100 })])).toEqual({ customers: [], vendors: [] });
  });

  test("positions at most nine per side plus Other", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `C${i}`, totalIncoming: 100 - i, totalOutgoing: 0, transactionCount: 1 }));
    const placed = positionCounterparts(many, [{ name: "V", totalIncoming: 0, totalOutgoing: 5, transactionCount: 1 }]);
    const customers = placed.filter((p) => p.side === "customer");
    expect(customers).toHaveLength(10);
    expect(customers[9].name).toBe("Other (3)");
    expect(customers[9].totalIncoming).toBe(91 + 90 + 89);
    expect(placed.filter((p) => p.side === "vendor")[0].x).toBe(850);
  });

  test("formats money", () => {
    expect(formatMoney(1234.5, "EURe")).toBe("1,234.50 EURe");
    expect(formatMoney(1234.5, "EUR", false)).toBe("1,235 EUR");
  });
});
