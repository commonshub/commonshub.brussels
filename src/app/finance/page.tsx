"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownLeft, ArrowUpRight, Wallet, RefreshCw } from "lucide-react";
import Link from "next/link";

interface MonthlyBreakdown {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

interface AccountSummary {
  slug: string;
  name: string;
  provider: string;
  chain?: string;
  address?: string;
  tokenSymbol: string;
  balance: number | null;
  totalInflow: number | null;
  totalOutflow: number | null;
  monthlyBreakdown: MonthlyBreakdown[];
}

export default function FinanceOverviewPage() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [aggregatedMonthlyBreakdown, setAggregatedMonthlyBreakdown] = useState<
    MonthlyBreakdown[]
  >([]);
  const [totalInflow, setTotalInflow] = useState<number>(0);
  const [totalOutflow, setTotalOutflow] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastModified, setLastModified] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(6);

  const loadData = () => {
    fetch("/api/financials")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setAccounts(data.accounts || []);
          setAggregatedMonthlyBreakdown(data.aggregatedMonthlyBreakdown || []);
          setTotalInflow(data.totalInflow || 0);
          setTotalOutflow(data.totalOutflow || 0);
          setLastModified(data.lastModified || null);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load financial data");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate total balance across all accounts (only EUR-based)
  const totalBalance = useMemo(() => {
    return Math.round(
      accounts.reduce((sum, acc) => sum + (acc.balance ?? 0), 0)
    );
  }, [accounts]);

  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    const date = new Date(Number.parseInt(year), Number.parseInt(m) - 1);
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  // Get per-account breakdown for a specific month
  const getAccountBreakdownForMonth = (monthKey: string) => {
    return accounts
      .map((account) => {
        const monthData = account.monthlyBreakdown?.find(
          (m) => m.month === monthKey
        );
        if (!monthData || (monthData.inflow === 0 && monthData.outflow === 0)) {
          return null;
        }
        return {
          account,
          monthData: {
            ...monthData,
            inflow: Math.round(monthData.inflow),
            outflow: Math.round(monthData.outflow),
            net: Math.round(monthData.net),
          },
        };
      })
      .filter(
        (
          item
        ): item is { account: AccountSummary; monthData: MonthlyBreakdown } =>
          item !== null
      )
      .sort((a, b) => {
        // Sort by net amount descending
        return b.monthData.net - a.monthData.net;
      });
  };

  const visibleMonthlyBreakdown = aggregatedMonthlyBreakdown.slice(
    0,
    visibleRows
  );
  const hasMoreRows = aggregatedMonthlyBreakdown.length > visibleRows;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading financial data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Transparent Finances</h1>
            <p className="text-muted-foreground">
              All community funds are managed transparently. Click on any
              account to see full details.
            </p>
          </div>

          {/* Total Summary Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Total Across All Accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold">
                €{(totalBalance ?? 0).toLocaleString()}
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span className="font-medium">
                    +€{Math.round(totalInflow).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="font-medium">
                    -€{Math.round(totalOutflow).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Net:</span>
                  <span
                    className={`font-medium ${totalInflow - totalOutflow >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {totalInflow - totalOutflow >= 0 ? "+" : ""}€
                    {Math.round(totalInflow - totalOutflow).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Excludes internal transfers between accounts
              </p>
            </CardContent>
          </Card>

          {/* Monthly Breakdown */}
          {aggregatedMonthlyBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Breakdown</CardTitle>
                <CardDescription>
                  Total income and expenses across all accounts per month. Click
                  on a row to see breakdown by account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right whitespace-nowrap w-[140px]">
                        Inflow
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap w-[140px]">
                        Outflow
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap w-[140px]">
                        Net
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleMonthlyBreakdown.map((month) => {
                      const accountBreakdown =
                        expandedMonth === month.month
                          ? getAccountBreakdownForMonth(month.month)
                          : [];
                      return (
                        <React.Fragment key={month.month}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() =>
                              setExpandedMonth(
                                expandedMonth === month.month
                                  ? null
                                  : month.month
                              )
                            }
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{formatMonth(month.month)}</span>
                                {expandedMonth === month.month ? (
                                  <span className="text-xs text-muted-foreground">
                                    ▼
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    ▶
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-green-600 whitespace-nowrap w-[140px]">
                              +€{month.inflow.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-red-600 whitespace-nowrap w-[140px]">
                              -€{month.outflow.toLocaleString()}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium whitespace-nowrap w-[140px] ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {month.net >= 0 ? "+" : ""}€
                              {month.net.toLocaleString()}
                            </TableCell>
                          </TableRow>
                          {expandedMonth === month.month &&
                            accountBreakdown.map(({ account, monthData }) => (
                              <TableRow
                                key={account.slug}
                                className="bg-muted/30"
                              >
                                <TableCell className="pl-8 py-2">
                                  <Link
                                    href={`/finance/${account.slug}`}
                                    className="font-medium hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {account.name}
                                  </Link>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({account.tokenSymbol})
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-green-600 py-2 whitespace-nowrap w-[140px]">
                                  +€{monthData.inflow.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-red-600 py-2 whitespace-nowrap w-[140px]">
                                  -€{monthData.outflow.toLocaleString()}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-medium py-2 whitespace-nowrap w-[140px] ${monthData.net >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  {monthData.net >= 0 ? "+" : ""}€
                                  {monthData.net.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                {hasMoreRows && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setVisibleRows(aggregatedMonthlyBreakdown.length)
                      }
                    >
                      Load More (
                      {aggregatedMonthlyBreakdown.length - visibleRows} more)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Account Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <Link key={account.slug} href={`/finance/${account.slug}`}>
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{account.name}</span>
                      {account.address && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {account.address.slice(0, 6)}...
                          {account.address.slice(-4)}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {account.provider === "stripe"
                        ? "Stripe"
                        : `${account.chain} blockchain`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">
                      {Math.round(account.balance ?? 0).toLocaleString()}{" "}
                      <span className="text-lg text-muted-foreground">
                        {account.tokenSymbol}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-600">
                        <ArrowDownLeft className="w-4 h-4" />+
                        {(account.totalInflow ?? 0).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <ArrowUpRight className="w-4 h-4" />-
                        {(account.totalOutflow ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Info Section */}
          <Card>
            <CardHeader>
              <CardTitle>About Our Financial Transparency</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                The Commons Hub Brussels believes in full financial
                transparency. All our accounts are visible to anyone, and most
                of our funds are held on the Gnosis blockchain where every
                transaction can be verified.
              </p>
              <p>
                We use <strong>EURe</strong> (Monerium Euro) for our main
                accounts - a regulated Euro stablecoin that can be converted 1:1
                to regular bank transfers. For internal community tokens, we use{" "}
                <strong>EURb</strong> (Brussels Euro) which powers our fridge
                and coffee systems.
              </p>
            </CardContent>
          </Card>

          {/* Last Modified & Refresh */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {lastModified ? (
                    <>
                      Data last updated:{" "}
                      <span className="font-medium">
                        {new Date(lastModified).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    "No cached data available"
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
