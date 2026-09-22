import { notFound } from "next/navigation";
import { CounterpartCards } from "@/components/finance/counterpart-cards";
import { FlowRows } from "@/components/finance/flow-cards";
import { isAdmin, isMember } from "@/lib/admin-check";
import { tierFor } from "@/lib/data-paths";
import { accountDisplay, counterpartBreakdown, flowsByAccount, flowsByMonth, loadFinanceTransactions, monthLabel } from "@/lib/finance-view";

interface PageProps {
  params: Promise<{ year: string }>;
}

// Reads the dataset volume and the session, so never prerender it.
export const dynamic = "force-dynamic";

/** Every account over a year. Members see counterparties by name; visitors do not. */
export default async function YearlyFinanceAggregatePage({ params }: PageProps) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();

  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()]);
  const tier = tierFor(userIsAdmin || userIsMember);

  const transactions = loadFinanceTransactions(tier, year);
  if (transactions.length === 0) notFound();

  const accounts = flowsByAccount(transactions);
  const { customers, vendors } = counterpartBreakdown(transactions);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">All Accounts - Finance</h1>
        <p className="text-muted-foreground">
          {year} - {transactions.length} transactions across {accounts.length} accounts
        </p>
      </div>

      <div className="mb-6">
        <FlowRows
          title="Accounts Overview"
          description={`Summary by account for ${year}`}
          rows={accounts.map(({ account, flow }) => ({
            key: account.slug,
            href: `/${year}/finance/${account.slug}`,
            label: account.name,
            sub: `${flow.count} transactions • ${accountDisplay(account).symbol}`,
            flow,
            symbol: accountDisplay(account).symbol,
            showNet: true,
          }))}
        />
      </div>

      <CounterpartCards customers={customers} vendors={vendors} symbol="EUR" period={year} />

      <FlowRows
        title="Monthly Breakdown"
        description="Combined transaction summary by month"
        rows={flowsByMonth(transactions).map(([key, flow]) => {
          const [y, m] = key.split("-");
          return { key, href: `/${y}/${m}/finance`, label: monthLabel(y, m), sub: `${flow.count} transactions`, flow, symbol: "EUR" };
        })}
      />
    </div>
  );
}
