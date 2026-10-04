"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MoneyFlowSankey } from "@/components/money-flow-sankey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FlowRow {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CollectiveFlow extends FlowRow {
  byCategory: FlowRow[];
  byAccount: FlowRow[];
}

interface FinancialFlowsProps {
  year: string;
  /** "09" for a month report; omitted for the year. */
  month?: string;
  income: number;
  expenses: number;
  net: number;
  openingBalance?: number | null;
  closingBalance?: number | null;
  byCategory: FlowRow[];
  byAccount: FlowRow[];
  collectives: CollectiveFlow[];
}

const ALL = "all";
const DEFAULT_COLLECTIVE = "commonshub";

const eur = (n: number) =>
  new Intl.NumberFormat("en-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** The month filter of the transactions table ("Sep 2025"). */
const monthLabel = (year: string, month: string) =>
  new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short" }).format(new Date(Number(year), Number(month) - 1, 15));

/**
 * Money flow for one collective at a time: Commons Hub by default, each
 * collective a chip (largest income first) so a hosted project's subsidy is
 * not read as the Hub's income. Every category and account row opens the
 * transactions behind it, where members can reclassify them.
 */
export function FinancialFlows(props: FinancialFlowsProps) {
  const { year, month, collectives } = props;
  const initial = collectives.some((c) => c.key === DEFAULT_COLLECTIVE) ? DEFAULT_COLLECTIVE : ALL;
  const [selected, setSelected] = useState<string>(initial);
  const current = collectives.find((c) => c.key === selected);

  const view = current
    ? { label: current.label, income: current.income, expenses: current.expenses, net: current.net, byCategory: current.byCategory, byAccount: current.byAccount }
    : { label: "All collectives", income: props.income, expenses: props.expenses, net: props.net, byCategory: props.byCategory, byAccount: props.byAccount };

  const href = useMemo(
    () => (extra: Record<string, string>) => {
      const params = new URLSearchParams();
      if (current) params.set("collective", current.key);
      if (month) params.set("month", monthLabel(year, month));
      for (const [k, v] of Object.entries(extra)) params.set(k, v);
      const qs = params.toString();
      return `/${year}/transactions${qs ? `?${qs}` : ""}`;
    },
    [current, month, year]
  );

  const chips = [
    ...collectives.map((c) => ({ key: c.key, label: c.label, income: c.income, expenses: c.expenses })),
    { key: ALL, label: "All collectives", income: props.income, expenses: props.expenses },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Collective" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {chips.map((c) => {
          const active = c.key === selected;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(c.key)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="block max-w-[14rem] truncate text-sm font-medium text-foreground">{c.label}</span>
              <span className="block text-xs tabular-nums">
                <span className="text-green-600">+{eur(c.income)}</span>{" "}
                <span className="text-red-600">−{eur(c.expenses)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <MoneyFlowSankey
        title={`Money flow · ${view.label}`}
        income={view.income}
        expenses={view.expenses}
        net={view.net}
        openingBalance={current ? undefined : props.openingBalance}
        closingBalance={current ? undefined : props.closingBalance}
        showBalances={!current}
        incomeBreakdown={view.byCategory}
        expenseBreakdown={view.byCategory}
        action={
          <span className="flex shrink-0 flex-wrap justify-end gap-x-4 gap-y-1">
            {current && current.key !== "unassigned" && (
              <Link href={`/collectives/${encodeURIComponent(current.key)}`} className="text-sm font-medium text-primary hover:underline">
                View collective →
              </Link>
            )}
            <Link href={href({})} className="text-sm font-medium text-primary hover:underline">
              Transactions →
            </Link>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <FlowTable title="By category" rows={view.byCategory} rowHref={(row) => href({ group: row.key })} />
        <FlowTable title="By account" rows={view.byAccount} rowHref={(row) => href({ account: row.key })} />
      </div>
    </div>
  );
}

function FlowTable({ title, rows, rowHref }: { title: string; rows: FlowRow[]; rowHref: (row: FlowRow) => string }) {
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
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className="group">
                <TableCell className="font-medium">
                  <Link href={rowHref(row)} className="underline-offset-2 group-hover:underline" title={`See the transactions: ${row.label}`}>
                    {row.label}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-green-600">{eur(row.income)}</TableCell>
                <TableCell className="text-right tabular-nums text-red-600">{eur(row.expenses)}</TableCell>
                <TableCell className={`text-right tabular-nums ${row.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {row.net >= 0 ? "+" : ""}
                  {eur(row.net)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
