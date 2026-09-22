import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { CounterpartCards } from "@/components/finance/counterpart-cards";
import { FlowSummary } from "@/components/finance/flow-cards";
import { isAdmin, isMember } from "@/lib/admin-check";
import { tierFor } from "@/lib/data-paths";
import { accountDisplay, counterpartBreakdown, findFinanceAccount, loadFinanceTransactions, monthLabel, sumFlows } from "@/lib/finance-view";

interface PageProps {
  params: Promise<{ year: string; month: string; accountSlug: string }>;
}

// Reads the dataset volume and the session, so never prerender it.
export const dynamic = "force-dynamic";

/** One account, one month. Members see counterparties by name; visitors do not. */
export default async function FinancePage({ params }: PageProps) {
  const { year, month, accountSlug } = await params;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) notFound();
  const account = findFinanceAccount(accountSlug);
  if (!account) notFound();

  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()]);
  const canEdit = userIsAdmin || userIsMember;
  const tier = tierFor(canEdit);

  const transactions = loadFinanceTransactions(tier, year, month, account);
  if (transactions.length === 0) notFound();

  const { symbol, chain, address } = accountDisplay(account);
  const period = monthLabel(year, month);
  const { customers, vendors } = counterpartBreakdown(transactions);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{account.name}</h1>
        <p className="text-muted-foreground">
          {period} - {transactions.length} transactions
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline">{chain}</Badge>
          <Badge variant="outline">{symbol}</Badge>
          {address && <Badge variant="outline">{address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address}</Badge>}
        </div>
      </div>

      <FlowSummary flow={sumFlows(transactions)} symbol={symbol} title="Monthly Summary" description={`Financial overview for ${period}`} />

      <CounterpartCards customers={customers} vendors={vendors} symbol={symbol} period={period} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Transactions</CardTitle>
          <CardDescription>Detailed transaction history</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FinanceTransactionTable
            transactions={transactions}
            accountAddress={address}
            accountName={account.name}
            tokenSymbol={symbol}
            tokenDecimals={2}
            chain={chain}
            isAdmin={userIsAdmin}
            canEdit={canEdit}
            viewScope="month"
          />
        </CardContent>
      </Card>
    </div>
  );
}
