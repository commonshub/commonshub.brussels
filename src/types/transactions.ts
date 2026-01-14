/**
 * Transactions data types
 * Generated from data/{year}/{month}/transactions.json
 */

export interface TransactionMetadata {
  collective?: string;
  project?: string | null;
  event?: string | null;
  category?: string;
  tags?: string[];
  description?: string;
  [key: string]: any;
}

export interface Transaction {
  id: string;
  provider: string;
  chain: string | null;
  account: string;
  accountSlug: string;
  accountName: string;
  currency: string;
  value: string;
  amount: number;
  grossAmount: number;
  normalizedAmount: number;
  fee: number;
  type: "CREDIT" | "DEBIT";
  counterparty: string;
  timestamp: number;
  stripeChargeId?: string;
  blockNumber?: number;
  hash?: string;
  from?: string;
  to?: string;
  metadata: TransactionMetadata;
}

export interface TransactionsFile {
  month: string;
  generatedAt: string;
  transactions: Transaction[];
}
