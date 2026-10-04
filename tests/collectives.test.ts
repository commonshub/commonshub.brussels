/**
 * @jest-environment node
 *
 * /collectives and /collectives/[collective]: a collective's balance is every
 * euro tagged with it, all years, counted the way the monthly report counts
 * it; the URL slug is forgiving; and each viewer reads exactly one tier.
 */

import fs from "fs";
import path from "path";
import { describe, expect, test } from "@jest/globals";
import {
  collectiveKeys,
  normalizeCollectiveSlug,
  resolveCollectiveKey,
  summarizeCollective,
  summarizeCollectives,
} from "../src/lib/collectives";
import { tierFor } from "../src/lib/data-paths";
import type { Transaction } from "../src/types/transactions";

let seq = 0;
function tx(partial: Partial<Transaction> & { amount: number; type: Transaction["type"] }, metadata: Transaction["metadata"] = {}): Transaction {
  seq++;
  return {
    id: `test:tx:${seq}`,
    provider: "etherscan",
    chain: null,
    accountId: "kbc",
    accountSlug: "kbc",
    accountName: "KBC",
    counterpartyId: null,
    currency: "EUR",
    value: String(partial.amount),
    netAmount: partial.amount,
    grossAmount: partial.amount,
    normalizedAmount: partial.amount,
    fee: 0,
    timestamp: Date.UTC(2024, 0, 1) / 1000,
    ...partial,
    metadata: { collective: "brusselspay", ...metadata },
  };
}

const at = (y: number, m: number) => Date.UTC(y, m - 1, 15) / 1000;

describe("collective balance", () => {
  const rows: Transaction[] = [
    // Counted: a subsidy in, consulting out (EURe burn), a voucher sale in EURb.
    tx({ type: "CREDIT", amount: 44441.59, timestamp: at(2025, 4) }, { category: "subsidy" }),
    tx({ type: "BURN", amount: -7260, currency: "EURe", accountSlug: "eoa", timestamp: at(2024, 10) }, { category: "consulting" }),
    tx({ type: "MINT", amount: 100, currency: "EURb", accountSlug: "checking", timestamp: at(2024, 6) }, { category: "debt" }),
    // Not counted.
    tx({ type: "INTERNAL", amount: -1000 }, { category: "consulting" }),
    tx({ type: "DEBIT", amount: -500 }, { category: "internal_transfer" }),
    tx({ type: "CREDIT", amount: 999 }, { category: "opening_balance" }),
    tx({ type: "CREDIT", amount: 123 }, { category: "subsidy", excluded: true }),
    tx({ type: "TRANSFER", amount: 50, currency: "EURe", accountSlug: "checking" }),
    tx({ type: "CREDIT", amount: 77, accountSlug: "not-our-account", accountId: "not-our-account" }),
    // Another collective.
    tx({ type: "CREDIT", amount: 10 }, { collective: "commonshub", category: "donation" }),
    // Contribution tokens: apart from the euros.
    tx({ type: "MINT", amount: 12, currency: "CHT", accountSlug: "cht" }),
    tx({ type: "BURN", amount: -2, currency: "CHT", accountSlug: "cht" }),
  ];

  const summary = summarizeCollective("brusselspay", rows);

  test("sums income and spending over all years, euros and euro stablecoins together", () => {
    expect(summary.income).toBe(44541.59);
    expect(summary.expenses).toBe(7260);
    expect(summary.balance).toBe(37281.59);
  });

  test("leaves out internal, internal_transfer, opening_balance, excluded, token transfers and foreign accounts", () => {
    const counted = summary.byYear.reduce((s, r) => s + r.income - r.expenses, 0);
    expect(Math.round(counted * 100) / 100).toBe(summary.balance);
  });

  test("breaks down by year (newest first) and by report category", () => {
    expect(summary.byYear.map((r) => [r.key, r.net])).toEqual([
      ["2025", 44441.59],
      ["2024", -7160],
    ]);
    const byCategory = Object.fromEntries(summary.byCategory.map((r) => [r.key, r.net]));
    expect(byCategory.subsidy).toBe(44441.59);
    expect(byCategory.consulting).toBe(-7260);
  });

  test("counts CHT apart, and every tagged row in the transaction count", () => {
    expect(summary.tokens).toEqual({ minted: 12, burnt: 2 });
    expect(summary.transactionCount).toBe(rows.length - 1);
    expect(summary.lastActivity).toBe(at(2025, 4));
  });

  test("Stripe rows count their net (normalized) amount and payouts are left out", () => {
    const stripe = (amount: number, normalizedAmount: number, category: string) =>
      tx({ type: "CREDIT", amount, normalizedAmount, provider: "stripe", accountSlug: "stripe", accountId: "stripe" }, { category });
    const s = summarizeCollective("brusselspay", [stripe(10, 9.5, "debt"), stripe(500, 500, "payout")]);
    expect(s.income).toBe(9.5);
  });

  test("the index lists settings collectives and any key a transaction carries, Commons Hub first", () => {
    const keys = collectiveKeys(rows);
    expect(keys).toEqual(expect.arrayContaining(["commonshub", "brusselspay", "openletter"]));
    const list = summarizeCollectives(rows);
    expect(list[0].key).toBe("commonshub");
    expect(list[1].key).toBe("brusselspay");
  });
});

describe("collective slug", () => {
  const keys = ["commonshub", "brusselspay", "regensunite-handbook"];

  test.each(["brusselspay", "BrusselsPay", "brussels-pay", "Brussels%20Pay", "BRUSSELS_PAY"])("%s → brusselspay", (slug) => {
    expect(resolveCollectiveKey(slug, keys)).toBe("brusselspay");
  });

  test("keys with dashes resolve with or without them", () => {
    expect(resolveCollectiveKey("regensunite-handbook", keys)).toBe("regensunite-handbook");
    expect(resolveCollectiveKey("RegensUniteHandbook", keys)).toBe("regensunite-handbook");
  });

  test("unknown or empty slugs resolve to nothing (404)", () => {
    expect(resolveCollectiveKey("nope", keys)).toBeNull();
    expect(resolveCollectiveKey("--", keys)).toBeNull();
    expect(normalizeCollectiveSlug("Brussels-Pay")).toBe("brusselspay");
  });
});

describe("collective pages read one tier per viewer", () => {
  test("anonymous visitors get the public tier, members the members tier", () => {
    expect(tierFor(false)).toBe("public");
    expect(tierFor(true)).toBe("members");
  });

  const pages = ["collectives/page.tsx", "collectives/[collective]/page.tsx"];

  test.each(pages)("%s picks its tier with tierFor(isMember) and never names a tier itself", (page) => {
    const source = fs.readFileSync(path.join(__dirname, "..", "src", "app", page), "utf-8");
    expect(source).toMatch(/tierFor\(/);
    expect(source).toMatch(/isMember\(\)/);
    expect(source).not.toMatch(/["'](members|stewards)["']/);
  });
});
