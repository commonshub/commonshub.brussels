import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { getFinancialsOverview } from "@/lib/financials";
import { MonthlyBreakdownTable } from "./monthly-breakdown-table";
import { AccountsBreakdown } from "./account-cards";
import { readAllAnnualAccounts } from "@/lib/annual-accounts";
import { loadFinanceOutlook } from "@/lib/finance-outlook";
import { FinanceOutlookSection } from "./outlook";

// Data is read from local files at request time; never statically cached.
export const dynamic = "force-dynamic";

export default async function FinanceOverviewPage() {
  const {
    accounts,
    archivedAccounts,
    aggregatedMonthlyBreakdown,
    totalInflow,
    totalOutflow,
    lastModified,
  } = getFinancialsOverview();

  const annualAccounts = readAllAnnualAccounts();

  // Total balance across all accounts (rounded)
  const totalBalance = Math.round(
    accounts.reduce((sum, acc) => sum + (acc.balance ?? 0), 0)
  );
  const outlook = loadFinanceOutlook(totalBalance);

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

          <FinanceOutlookSection outlook={outlook} />

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
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="whitespace-nowrap">
                  <span className="text-muted-foreground">In </span>
                  <span className="font-medium tabular-nums text-green-600">€{Math.round(totalInflow).toLocaleString()}</span>
                </span>
                <span className="whitespace-nowrap">
                  <span className="text-muted-foreground">Out </span>
                  <span className="font-medium tabular-nums text-red-600">€{Math.round(totalOutflow).toLocaleString()}</span>
                </span>
                <span className="whitespace-nowrap">
                  <span className="text-muted-foreground">Net </span>
                  <span className={`font-medium tabular-nums ${totalInflow - totalOutflow >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {totalInflow - totalOutflow < 0 ? "−" : ""}€{Math.abs(Math.round(totalInflow - totalOutflow)).toLocaleString()}
                  </span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Inflow and outflow count every transaction across all active
                accounts (including transfers between them), so the net equals
                the change in total balance.
              </p>
            </CardContent>
          </Card>

          <AccountsBreakdown active={accounts} archived={archivedAccounts} />

          {/* Monthly Breakdown (interactive) */}
          <MonthlyBreakdownTable
            accounts={accounts}
            aggregatedMonthlyBreakdown={aggregatedMonthlyBreakdown}
          />

          {/* Annual accounts, as filed with the National Bank */}
          {annualAccounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Annual accounts</CardTitle>
                <CardDescription>
                  As filed with the National Bank of Belgium, with their known issues. The books by account number:{" "}
                  <a href="/opendata/latest/accounts-chart.json" className="underline underline-offset-2">chart of accounts</a> and yearly{" "}
                  <a href="/opendata" className="underline underline-offset-2">ledger balances</a> (open data).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {annualAccounts.map((fy) => (
                    <li key={fy.label} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <a href={`/${fy.year}#annual-accounts`} className="font-medium text-primary underline-offset-2 hover:underline">
                        Fiscal year {fy.label}
                      </a>
                      <span className="text-muted-foreground">
                        {fy.period.start} → {fy.period.end}
                        {fy.checks.some((c) => c.level !== "info") ? " · known issues noted" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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

          {/* Last Modified */}
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
