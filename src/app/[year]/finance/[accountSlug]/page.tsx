import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { WalletAddress } from "@/components/wallet-address";
import { CounterpartCards } from "@/components/finance/counterpart-cards";
import { FlowRows, FlowSummary } from "@/components/finance/flow-cards";
import { isAdmin, isMember } from "@/lib/admin-check";
import { tierFor } from "@/lib/data-paths";
import { accountDisplay, counterpartBreakdown, findFinanceAccount, flowsByMonth, loadFinanceTransactions, monthLabel, sumFlows } from "@/lib/finance-view";

interface PageProps {
  params: Promise<{ year: string; accountSlug: string }>;
}

// Reads the dataset volume and the session, so never prerender it.
export const dynamic = "force-dynamic";

/** One account over a year. Members see counterparties by name; visitors do not. */
export default async function YearlyFinancePage({ params }: PageProps) {
  const { year, accountSlug } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  const account = findFinanceAccount(accountSlug);
  if (!account) notFound();

  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()]);
  const canEdit = userIsAdmin || userIsMember;
  const tier = tierFor(canEdit);

  const transactions = loadFinanceTransactions(tier, year, undefined, account);
  if (transactions.length === 0) notFound();

  const { symbol, chain, address } = accountDisplay(account);
  const { customers, vendors } = counterpartBreakdown(transactions);
  const isOnChain = account.provider === "etherscan" && address.startsWith("0x");

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{account.name}</h1>
        <p className="text-muted-foreground">
          {year} - {transactions.length} transactions
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline">{chain}</Badge>
          <Badge variant="outline">{symbol}</Badge>
          {isOnChain ? <WalletAddress address={address} chain={chain} /> : address && <Badge variant="outline">{address}</Badge>}
        </div>
      </div>

      <FlowSummary flow={sumFlows(transactions)} symbol={symbol} title="Yearly Summary" description={`Financial overview for ${year}`} />

      <CounterpartCards customers={customers} vendors={vendors} symbol={symbol} period={year} />

      <FlowRows
        title="Monthly Breakdown"
        description="Transaction summary by month"
        rows={flowsByMonth(transactions).map(([key, flow]) => {
          const [y, m] = key.split("-");
          return { key, href: `/${y}/${m}/finance/${accountSlug}`, label: monthLabel(y, m), sub: `${flow.count} transactions`, flow, symbol };
        })}
      />

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">All Transactions</CardTitle>
          <CardDescription>Detailed transaction history for {year}</CardDescription>
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
