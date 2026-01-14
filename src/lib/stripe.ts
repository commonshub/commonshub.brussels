/**
 * Stripe API helper functions
 * Fetches balance and transactions from Stripe API
 */

import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Use TZ environment variable or default to Europe/Brussels
const TIMEZONE = process.env.TZ || "Europe/Brussels";

export interface StripeBalance {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
  connect_reserved?: Array<{ amount: number; currency: string }>;
  instant_available?: Array<{ amount: number; currency: string }>;
}

export interface StripeTransaction {
  id: string;
  created: number;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  type: string;
  description?: string;
  source?: any;
  reporting_category: string;
  metadata?: {
    event_api_id?: string;
    to?: string;
    [key: string]: any;
  };
}

export interface StripeTransactionsResponse {
  data: StripeTransaction[];
  has_more: boolean;
  object: string;
  url: string;
}

/**
 * Get month key from timestamp (YYYY-MM format)
 * Converts UTC timestamp to local timezone before extracting month
 */
export function getMonthKey(timestamp: number): string {
  const utcDate = new Date(timestamp * 1000);
  const zonedDate = toZonedTime(utcDate, TIMEZONE);
  return `${zonedDate.getFullYear()}-${String(zonedDate.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Get month key from Date object (YYYY-MM format)
 * Assumes date is already in local timezone
 */
export function getMonthKeyFromDate(date: Date): string {
  const zonedDate = toZonedTime(date, TIMEZONE);
  return `${zonedDate.getFullYear()}-${String(zonedDate.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fetch balance from Stripe API
 */
export async function fetchStripeBalance(
  secretKey: string
): Promise<StripeBalance> {
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const response = await fetch("https://api.stripe.com/v1/balance", {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Stripe balance: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch current month transactions from Stripe API
 * Only fetches transactions from the start of the current month
 */
export async function fetchCurrentMonthTransactions(
  secretKey: string
): Promise<StripeTransaction[]> {
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const currentMonth = getMonthKeyFromDate(new Date());
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  const firstDayTimestamp = Math.floor(firstDayOfMonth.getTime() / 1000);

  let hasMore = true;
  let startingAfter: string | undefined;
  const allTransactions: StripeTransaction[] = [];

  while (hasMore) {
    const url = new URL("https://api.stripe.com/v1/balance_transactions");
    url.searchParams.set("limit", "100");
    url.searchParams.set("created[gte]", firstDayTimestamp.toString());
    if (startingAfter) {
      url.searchParams.set("starting_after", startingAfter);
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Stripe transactions: ${response.statusText}`
      );
    }

    const data: StripeTransactionsResponse = await response.json();

    if (data.data && data.data.length > 0) {
      // Filter to ensure we only get current month (in case of timezone issues)
      const currentMonthTxs = data.data.filter((tx) => {
        const txMonth = getMonthKey(tx.created);
        return txMonth === currentMonth;
      });

      allTransactions.push(...currentMonthTxs);

      // Stop if we've encountered a transaction from a previous month
      // (this means we've fetched all current month transactions)
      const hasPreviousMonthTx = data.data.some((tx) => {
        const txMonth = getMonthKey(tx.created);
        return txMonth !== currentMonth;
      });

      if (hasPreviousMonthTx || !data.has_more) {
        hasMore = false;
      } else {
        startingAfter = data.data[data.data.length - 1].id;
        hasMore = true;
      }
    } else {
      hasMore = false;
    }
  }

  return allTransactions;
}

/**
 * Calculate balance from Stripe balance data
 */
export function calculateStripeBalance(
  balanceData: StripeBalance,
  currency: string = "eur"
): number {
  const availableBalance =
    balanceData.available?.find((b) => b.currency === currency) ||
    balanceData.available?.[0] ||
    { amount: 0 };
  const pendingBalance =
    balanceData.pending?.find((b) => b.currency === currency) ||
    balanceData.pending?.[0] ||
    { amount: 0 };

  // Stripe amounts are in cents
  return (availableBalance.amount + pendingBalance.amount) / 100;
}




