"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, Image as ImageIcon } from "lucide-react";
import Link from "next/link";

interface MonthlyReportCardProps {
  year: string;
  month: string;
  activeMembers: number;
  photos: number;
  income: number;
  expenses: number;
  embedded?: boolean; // Whether this is embedded in yearly report
  expandable?: boolean; // Whether this can be expanded
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MonthlyReportCard({
  year,
  month,
  activeMembers,
  photos,
  income,
  expenses,
  embedded = false,
  expandable = true,
}: MonthlyReportCardProps) {
  const monthName = MONTH_NAMES[parseInt(month, 10) - 1] || month;
  const net = income - expenses;
  const isProfit = net >= 0;

  const content = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Active Members */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Active Members</span>
        </div>
        <p className="text-2xl font-bold">{activeMembers}</p>
      </div>

      {/* Photos */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span>Photos</span>
        </div>
        <p className="text-2xl font-bold">{photos}</p>
      </div>

      {/* Income */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span>Income</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{formatCurrency(income)}</p>
      </div>

      {/* Expenses */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingDown className="h-4 w-4 text-red-600" />
          <span>Expenses</span>
        </div>
        <p className="text-2xl font-bold text-red-600">{formatCurrency(expenses)}</p>
      </div>
    </div>
  );

  if (embedded) {
    // Embedded in yearly report - simpler card
    return (
      <Card className="hover:bg-muted/50 transition-colors">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{monthName}</CardTitle>
              <CardDescription>{year}</CardDescription>
            </div>
            <Badge variant={isProfit ? "default" : "destructive"}>
              {isProfit ? "+" : ""}{formatCurrency(net)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  // Standalone card with optional link
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">
              {monthName} {year}
            </CardTitle>
            <CardDescription>Monthly Report</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Net</p>
            <p className={`text-2xl font-bold ${isProfit ? "text-green-600" : "text-red-600"}`}>
              {isProfit ? "+" : ""}{formatCurrency(net)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {content}
        {expandable && (
          <div className="mt-6">
            <Link
              href={`/${year}/${month}`}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center"
            >
              View full report →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
