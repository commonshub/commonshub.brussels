import { notFound } from "next/navigation";
import Link from "next/link";
import { CounterpartCards } from "@/components/finance/counterpart-cards";
import { FlowRows } from "@/components/finance/flow-cards";
import { isAdmin, isMember } from "@/lib/admin-check";
import { tierFor } from "@/lib/data-paths";
import { accountDisplay, counterpartBreakdown, flowsByAccount, loadFinanceTransactions, monthLabel } from "@/lib/finance-view";

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

// Reads the dataset volume and the session, so never prerender it.
export const dynamic = "force-dynamic";

/** Every account, one month. Members see counterparties by name; visitors do not. */
export default async function MonthlyFinanceAggregatePage({ params }: PageProps) {
  const { year, month } = await params;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) notFound();

  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()]);
  const tier = tierFor(userIsAdmin || userIsMember);

  const transactions = loadFinanceTransactions(tier, year, month);
  if (transactions.length === 0) notFound();

  const accounts = flowsByAccount(transactions);
  const { customers, vendors } = counterpartBreakdown(transactions);
  const period = monthLabel(year, month);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">All Accounts - Finance</h1>
        <p className="text-muted-foreground">
          {period} - {transactions.length} transactions across {accounts.length} accounts
        </p>
        <p className="text-sm mt-2">
          <Link href={`/${year}/${month}/transactions`} className="underline underline-offset-4 hover:text-foreground">
            All transactions of {period}
          </Link>
        </p>
      </div>

      <div className="mb-6">
        <FlowRows
          title="Accounts Overview"
          description="Summary by account"
          rows={accounts.map(({ account, flow }) => ({
            key: account.slug,
            href: `/${year}/${month}/finance/${account.slug}`,
            label: account.name,
            sub: `${flow.count} transactions • ${accountDisplay(account).symbol}`,
            flow,
            symbol: accountDisplay(account).symbol,
            showNet: true,
          }))}
        />
      </div>

      <CounterpartCards customers={customers} vendors={vendors} symbol="EUR" period={period} />
    </div>
  );
}
