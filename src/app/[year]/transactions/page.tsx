import { notFound } from "next/navigation";
import { isAdmin, isMember } from "@/lib/admin-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { tierFor } from "@/lib/data-paths";
import { listMonths } from "@/lib/dataset";
import {
  readMonthlyTransactions,
  readMonthlyCounterpartyMetadata,
  augmentTransaction,
} from "@/lib/transactions";
import type { CounterpartyMetadata } from "@/types/counterparties";
import type { Transaction } from "@/types/transactions";

interface PageProps {
  params: Promise<{
    year: string;
  }>;
}


export default async function YearlyTransactionsPage({ params }: PageProps) {
  const { year } = await params;
  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()]);
  const canEdit = userIsAdmin || userIsMember;
  // Members read the members tier (counterparty names inline), everyone
  // else the public tier. One tier per viewer, never merged.
  const tier = tierFor(canEdit);
  const months = listMonths(year, tier);
  if (months.length === 0) notFound();

  const transactions: Transaction[] = [];
  const counterpartyMetadataMap = new Map<string, CounterpartyMetadata>();
  for (const month of months) {
    transactions.push(...readMonthlyTransactions(year, month, tier));
    const meta = readMonthlyCounterpartyMetadata(year, month, tier);
    for (const [id, m] of meta) counterpartyMetadataMap.set(id, m);
  }

  if (transactions.length === 0) notFound();

  const augmentedTransactions = transactions
    .map((tx) => augmentTransaction(tx, counterpartyMetadataMap))
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div
      className={
        canEdit
          ? "w-full py-8 px-4"
          : "container mx-auto py-8 px-4 max-w-6xl"
      }
    >
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          All Transactions {year}
        </h1>
        <p className="text-muted-foreground">
          {augmentedTransactions.length} transactions across all accounts
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Transactions</CardTitle>
          <CardDescription>All transactions for {year}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FinanceTransactionTable
            transactions={augmentedTransactions}
            accountAddress=""
            accountName="All Accounts"
            tokenSymbol="EUR"
            tokenDecimals={2}
            chain="gnosis"
            isAdmin={userIsAdmin}
            canEdit={canEdit}
            showAccountColumn={true}
            showExportButton={true}
            useNormalizedAmount={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
