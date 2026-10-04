/**
 * Collectives: the projects Commons Hub hosts, each one the set of
 * transactions chb tags `metadata.collective === <key>`.
 *
 * A collective's balance is everything it ever received minus everything it
 * spent, across all years, counted exactly as the monthly report counts it
 * (reportFlowFor): internal transfers, Stripe payouts, token transfers,
 * internal_transfer / opening_balance rows and excluded rows are left out.
 * Euros and the euro stablecoins (EURe, EURb) are one balance; CHT
 * contribution tokens are counted apart, minted vs burnt.
 *
 * Readers pick one audience tier (tierFor) and never merge tiers, like every
 * other dataset reader.
 */

import settings from "@/settings/settings.json";
import { listMonths, listYears } from "./dataset";
import type { Tier } from "./data-paths";
import { collectiveLabel, isExcluded, reportFlowFor } from "./reports";
import { readMonthlyCounterpartyMetadata, readMonthlyTransactions } from "./transactions";
import type { CounterpartyMetadata } from "@/types/counterparties";
import type { Transaction } from "@/types/transactions";

export const EURO_CURRENCIES = new Set(["EUR", "EURe", "EURb"]);
const CHT_SYMBOL = settings.contributionToken?.symbol ?? "CHT";

export interface CollectiveRow {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CollectiveSummary {
  key: string;
  label: string;
  /** Euros in minus euros out, all years. */
  balance: number;
  income: number;
  expenses: number;
  /** CHT minted to / burnt from this collective's rows, when it has any. */
  tokens: { minted: number; burnt: number };
  byYear: CollectiveRow[];
  byCategory: CollectiveRow[];
  /** Timestamp (seconds) of its most recent transaction, counted or not. */
  lastActivity: number | null;
  /** Transactions tagged with the collective, counted or not. */
  transactionCount: number;
}

/** "Brussels-Pay", "brussels pay", "BrusselsPay" → "brusselspay". */
export function normalizeCollectiveSlug(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // keep the raw slug
  }
  return decoded.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The collective key a URL slug points at, or null when there is none. */
export function resolveCollectiveKey(slug: string, keys: Iterable<string>): string | null {
  const wanted = normalizeCollectiveSlug(slug);
  if (!wanted) return null;
  let match: string | null = null;
  for (const key of keys) {
    if (key === slug) return key;
    if (!match && normalizeCollectiveSlug(key) === wanted) match = key;
  }
  return match;
}

const collectiveOf = (tx: Transaction): string | null => {
  const value = tx.metadata?.collective;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

/** Every collective key: those in settings, then any other one a transaction carries. */
export function collectiveKeys(transactions: Transaction[]): string[] {
  const keys = new Set(Object.keys(settings.finance.collectives));
  for (const tx of transactions) {
    const key = collectiveOf(tx);
    if (key) keys.add(key);
  }
  return Array.from(keys);
}

function addRow(map: Map<string, CollectiveRow>, key: string, label: string, direction: "CREDIT" | "DEBIT", amount: number) {
  const row = map.get(key) ?? { key, label, income: 0, expenses: 0, net: 0 };
  if (direction === "CREDIT") row.income += amount;
  else row.expenses += amount;
  row.net = row.income - row.expenses;
  map.set(key, row);
}

/** Round to the cent so float noise never prints as "−€0". */
const cents = (n: number) => Math.round(n * 100) / 100;

const yearOf = (tx: Transaction) => String(new Date(tx.timestamp * 1000).getUTCFullYear());

/** One collective's totals from the transactions tagged with it. */
export function summarizeCollective(key: string, transactions: Transaction[]): CollectiveSummary {
  const byYear = new Map<string, CollectiveRow>();
  const byCategory = new Map<string, CollectiveRow>();
  let income = 0;
  let expenses = 0;
  let minted = 0;
  let burnt = 0;
  let lastActivity: number | null = null;
  let transactionCount = 0;

  for (const tx of transactions) {
    if (collectiveOf(tx) !== key) continue;
    transactionCount++;
    if (lastActivity == null || tx.timestamp > lastActivity) lastActivity = tx.timestamp;

    if (tx.currency === CHT_SYMBOL) {
      // Contribution tokens are not money: kept apart, minted vs burnt.
      if (isExcluded(tx)) continue;
      if (tx.type === "MINT") minted += Math.abs(tx.amount);
      else if (tx.type === "BURN") burnt += Math.abs(tx.amount);
      continue;
    }
    if (!EURO_CURRENCIES.has(tx.currency)) continue;
    const flow = reportFlowFor(tx);
    if (!flow) continue;

    if (flow.direction === "CREDIT") income += flow.amount;
    else expenses += flow.amount;
    const year = yearOf(tx);
    addRow(byYear, year, year, flow.direction, flow.amount);
    addRow(byCategory, flow.category.key, flow.category.label, flow.direction, flow.amount);
  }

  const rounded = (rows: Map<string, CollectiveRow>) =>
    Array.from(rows.values()).map((r) => ({ ...r, income: cents(r.income), expenses: cents(r.expenses), net: cents(r.net) }));

  return {
    key,
    label: collectiveLabel(key),
    balance: cents(income - expenses),
    income: cents(income),
    expenses: cents(expenses),
    tokens: { minted: cents(minted), burnt: cents(burnt) },
    byYear: rounded(byYear).sort((a, b) => b.key.localeCompare(a.key)),
    byCategory: rounded(byCategory).sort(
      (a, b) => Math.abs(b.income) + Math.abs(b.expenses) - (Math.abs(a.income) + Math.abs(a.expenses))
    ),
    lastActivity,
    transactionCount,
  };
}

/** Every collective, largest income first, Commons Hub on top. */
export function summarizeCollectives(transactions: Transaction[]): CollectiveSummary[] {
  return collectiveKeys(transactions)
    .map((key) => summarizeCollective(key, transactions))
    .sort((a, b) => {
      if (a.key === "commonshub") return -1;
      if (b.key === "commonshub") return 1;
      return b.income - a.income || b.transactionCount - a.transactionCount || a.label.localeCompare(b.label);
    });
}

export interface MonthTransactions {
  year: string;
  month: string;
  transactions: Transaction[];
}

/** Every month's transactions of one tier, all years, oldest first. */
export function readAllMonths(tier: Tier): MonthTransactions[] {
  const out: MonthTransactions[] = [];
  for (const year of listYears()) {
    for (const month of listMonths(year, tier)) {
      out.push({ year, month, transactions: readMonthlyTransactions(year, month, tier) });
    }
  }
  return out;
}

/** The rows tagged with one collective, with the counterparty names that tier carries for those months. */
export function collectiveTransactions(
  key: string,
  months: MonthTransactions[],
  tier: Tier
): { transactions: Transaction[]; counterparties: Map<string, CounterpartyMetadata> } {
  const transactions: Transaction[] = [];
  const counterparties = new Map<string, CounterpartyMetadata>();
  for (const { year, month, transactions: rows } of months) {
    const mine = rows.filter((tx) => collectiveOf(tx) === key);
    if (!mine.length) continue;
    transactions.push(...mine);
    for (const [id, meta] of readMonthlyCounterpartyMetadata(year, month, tier)) counterparties.set(id, meta);
  }
  return { transactions, counterparties };
}
