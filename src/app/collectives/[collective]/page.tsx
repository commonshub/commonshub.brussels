import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { isAdmin, isMember } from "@/lib/admin-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinanceTransactionTable } from "@/components/finance-transaction-table";
import { tierFor } from "@/lib/data-paths";
import { collectiveKeys, collectiveTransactions, readAllMonths, resolveCollectiveKey, summarizeCollective, type CollectiveRow } from "@/lib/collectives";
import { collectiveLabel, reportCategoryFor } from "@/lib/reports";
import { augmentTransaction } from "@/lib/transactions";
import { eur, signedEur, shortDate, tokens } from "../format";

// Read from the dataset at request time; never prerendered.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ collective: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { collective } = await params;
  const label = collectiveLabel(collective);
  return {
    title: `${label} | Collectives | Commons Hub Brussels`,
    description: `What ${label} received, spent and holds, with every transaction.`,
  };
}

export default async function CollectivePage({ params }: PageProps) {
  const { collective: slug } = await params;
  const [userIsAdmin, userIsMember] = await Promise.all([isAdmin(), isMember()]);
  const canEdit = userIsAdmin || userIsMember;
  // Members read the members tier (counterparty names inline), everyone
  // else the public tier, which names no private individual. One tier per
  // viewer, never merged.
  const tier = tierFor(canEdit);
  const months = readAllMonths(tier);
  const all = months.flatMap((m) => m.transactions);

  const key = resolveCollectiveKey(slug, collectiveKeys(all));
  if (!key) notFound();
  if (key !== slug) redirect(`/collectives/${encodeURIComponent(key)}`);

  const summary = summarizeCollective(key, all);
  const { transactions, counterparties } = collectiveTransactions(key, months, tier);
  const rows = transactions
    .map((tx) => {
      // The report's category group, as on the yearly transactions page.
      const group = reportCategoryFor(tx);
      return { ...augmentTransaction(tx, counterparties), reportCategory: group?.key, reportCategoryLabel: group?.label };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const hasTokens = summary.tokens.minted > 0 || summary.tokens.burnt > 0;

  // The host's tagged flows are not its balance (opening balances, money held for collectives).
  const isHost = summary.key === "commonshub";

  return (
    <div className={canEdit ? "w-full px-4 py-8" : "container mx-auto max-w-6xl px-4 py-8"}>
      <div className="mb-6 space-y-2">
        <Link href="/collectives" className="text-sm text-muted-foreground hover:underline">
          ← All collectives
        </Link>
        <h1 className="text-3xl font-bold">{summary.label}</h1>
        <p className="text-muted-foreground">
          {summary.transactionCount} transactions
          {summary.lastActivity ? `, last on ${shortDate(summary.lastActivity)}` : ""}. The balance counts every
          euro tagged with this collective since the beginning; transfers between our own accounts are not counted.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {isHost ? "Net of everything tagged Commons Hub" : "Current balance"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`text-4xl font-bold tabular-nums ${summary.balance < 0 ? "text-red-600" : ""}`}>
              {signedEur(summary.balance)}
            </div>
            {isHost && (
              <p className="text-sm text-muted-foreground">
                Not a bank balance: the host's opening balances and the money it holds for others are not tagged.
                The real balances of our accounts are on{" "}
                <Link href="/finance" className="underline underline-offset-2">
                  /finance
                </Link>
                .
              </p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <ArrowDownLeft className="h-4 w-4" />
                <span className="font-medium tabular-nums">{eur(summary.income)}</span> in
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <ArrowUpRight className="h-4 w-4" />
                <span className="font-medium tabular-nums">{eur(summary.expenses)}</span> out
              </span>
              {hasTokens && (
                <span className="text-muted-foreground">
                  CHT: {tokens(summary.tokens.minted)} minted, {tokens(summary.tokens.burnt)} burnt
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">EUR, EURe and EURb are counted together as euros.</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <BreakdownCard title="By year" rows={summary.byYear} />
          <BreakdownCard title="By category" rows={summary.byCategory} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Transactions</CardTitle>
            <CardDescription>Every transaction tagged {summary.label}, newest first.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length ? (
              <FinanceTransactionTable
                transactions={rows}
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
            ) : (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No transactions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: CollectiveRow[] }) {
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums text-green-600">{eur(row.income)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600">{eur(row.expenses)}</TableCell>
                <TableCell className={`text-right tabular-nums ${row.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {signedEur(row.net)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
