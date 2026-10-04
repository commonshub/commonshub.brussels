import type { Metadata } from "next";
import Link from "next/link";
import { isMember } from "@/lib/admin-check";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tierFor } from "@/lib/data-paths";
import { readAllMonths, summarizeCollectives } from "@/lib/collectives";
import { eur, signedEur, shortDate } from "./format";

// Read from the dataset at request time; never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collectives | Commons Hub Brussels",
  description: "The projects Commons Hub Brussels hosts: what each one received, spent and holds.",
};

export default async function CollectivesPage() {
  // Members read the members tier, everyone else the public tier. The
  // figures are the same in both; only the transactions behind them differ.
  const tier = tierFor(await isMember());
  const months = readAllMonths(tier);
  const collectives = summarizeCollectives(months.flatMap((m) => m.transactions)).filter((c) => c.transactionCount > 0);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold">Collectives</h1>
        <p className="text-muted-foreground">
          Commons Hub Brussels hosts projects that run their money through its accounts. Each transaction is tagged
          with the collective it belongs to; a collective&apos;s balance is all it received minus all it spent, since
          the beginning. Transfers between our own accounts are not counted.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">All collectives</CardTitle>
          <CardDescription>Largest income first. Amounts in euros (EUR, EURe and EURb together).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collective</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Total in</TableHead>
                <TableHead className="text-right">Total out</TableHead>
                <TableHead className="text-right">Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collectives.map((c) => (
                <TableRow key={c.key} className="group">
                  <TableCell className="font-medium">
                    <Link href={`/collectives/${encodeURIComponent(c.key)}`} className="text-primary underline-offset-2 group-hover:underline">
                      {c.label}
                    </Link>
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${c.balance < 0 ? "text-red-600" : ""}`}>{signedEur(c.balance)}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600">{eur(c.income)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-600">{eur(c.expenses)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                    {c.lastActivity ? shortDate(c.lastActivity) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
