"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface MonthlyBreakdown {
  month: string;
  income: number;
  expenses: number;
  activeMembers: number;
  tokensMinted?: number;
  tokensBurnt?: number;
}

interface ReportFinancialChartsProps {
  monthlyBreakdown: MonthlyBreakdown[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(monthStr: string): string {
  const month = parseInt(monthStr, 10);
  return MONTH_LABELS[month - 1] || monthStr;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const financialsChartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(0, 84%, 60%)",
  },
} satisfies ChartConfig;

const tokensChartConfig = {
  tokensMinted: {
    label: "Minted",
    color: "hsl(221, 83%, 53%)",
  },
  tokensBurnt: {
    label: "Burnt",
    color: "hsl(25, 95%, 53%)",
  },
} satisfies ChartConfig;

const membersChartConfig = {
  activeMembers: {
    label: "Active Members",
    color: "hsl(262, 83%, 58%)",
  },
} satisfies ChartConfig;

export function ReportFinancialCharts({ monthlyBreakdown }: ReportFinancialChartsProps) {
  // Format data for charts
  const chartData = monthlyBreakdown.map((item) => ({
    month: formatMonth(item.month),
    income: Math.round(item.income),
    expenses: Math.round(item.expenses),
    activeMembers: item.activeMembers,
    tokensMinted: Math.round(item.tokensMinted || 0),
    tokensBurnt: Math.round(item.tokensBurnt || 0),
  }));

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data available for charts
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Income vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses</CardTitle>
          <CardDescription>Monthly comparison of income and expenses</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={financialsChartConfig} className="h-[300px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `€${Math.round(value)}`}
                className="text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value as number)}
                  />
                }
              />
              <Bar
                dataKey="income"
                fill="var(--color-income)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                fill="var(--color-expenses)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Tokens Minted vs Burnt Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tokens Minted vs Burnt</CardTitle>
          <CardDescription>Monthly comparison of token minting and burning</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={tokensChartConfig} className="h-[300px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      const label = name === 'tokensMinted' ? 'tokens minted' : 'tokens burnt';
                      return `${value} ${label}`;
                    }}
                  />
                }
              />
              <Bar
                dataKey="tokensMinted"
                fill="var(--color-tokensMinted)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="tokensBurnt"
                fill="var(--color-tokensBurnt)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Active Members Chart - Full Width */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Active Members per Month</CardTitle>
          <CardDescription>Number of active community members (authors + mentioned users)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={membersChartConfig} className="h-[300px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value} members`}
                  />
                }
              />
              <Bar
                dataKey="activeMembers"
                fill="var(--color-activeMembers)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
