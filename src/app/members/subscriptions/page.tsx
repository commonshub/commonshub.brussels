"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, TrendingUp, Calendar, CreditCard, ArrowLeft } from "lucide-react";
import type { MembersFile, Member } from "@/types/members";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-EU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusColor(status: Member["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "trialing":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "past_due":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "canceled":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    case "incomplete":
    case "unpaid":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getPlanBadge(plan: Member["plan"]): JSX.Element {
  if (plan === "yearly") {
    return (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700">
        Yearly
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700">
      Monthly
    </Badge>
  );
}

// Generate month options for the last 24 months
function getMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const value = `${year}-${String(month).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  
  return options;
}

export default function MemberSubscriptionsPage() {
  const [data, setData] = useState<MembersFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthOptions = getMonthOptions();

  useEffect(() => {
    setLoading(true);
    setError(null);

    const [year, month] = selectedMonth.split("-");

    fetch(`/api/members?year=${year}&month=${month}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("No membership data available for this month yet.");
          }
          throw new Error("Failed to fetch membership data");
        }
        return res.json();
      })
      .then((data: MembersFile) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedMonth]);

  return (
    <div className="min-h-screen bg-background pt-24">
      <main className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/members" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Community
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Membership Subscriptions</h1>
              <p className="text-muted-foreground mt-1">
                Supporting members who contribute financially to the Commons Hub
              </p>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardHeader>
              <CardTitle className="text-yellow-800 dark:text-yellow-200">No Data Available</CardTitle>
              <CardDescription className="text-yellow-700 dark:text-yellow-300">
                {error}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : data ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Active Members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.summary.activeMembers}</p>
                  <p className="text-sm text-muted-foreground">
                    of {data.summary.totalMembers} total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Monthly Revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">
                    {formatCurrency(data.summary.mrr)}
                  </p>
                  <p className="text-sm text-muted-foreground">MRR</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Monthly Plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.summary.monthlyMembers}</p>
                  <p className="text-sm text-muted-foreground">€10/month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Yearly Plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data.summary.yearlyMembers}</p>
                  <p className="text-sm text-muted-foreground">€100/year</p>
                </CardContent>
              </Card>
            </div>

            {/* Members Table */}
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  {data.members.length} members in {monthOptions.find(o => o.value === selectedMonth)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Latest Payment</TableHead>
                        <TableHead className="hidden md:table-cell">Member Since</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{member.firstName}</span>
                              {member.accounts.discord && (
                                <span className="text-xs text-muted-foreground">
                                  @{member.accounts.discord}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getPlanBadge(member.plan)}
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(member.amount)}/{member.interval}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(member.status)} variant="secondary">
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {member.latestPayment ? (
                              <div className="flex flex-col">
                                <span className="text-sm">
                                  {formatCurrency(member.latestPayment.amount)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(member.latestPayment.date)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(member.createdAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.members.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No members found for this month
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Join CTA */}
            <Card className="mt-8 bg-gradient-to-r from-primary/10 to-primary/5">
              <CardHeader>
                <CardTitle>Become a Member</CardTitle>
                <CardDescription>
                  Support the Commons Hub Brussels and get access to member benefits
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://buy.stripe.com/00g9C7dFH8EI07eaEJ"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                  >
                    Monthly — €10/month
                  </a>
                  <a
                    href="https://buy.stripe.com/5kA4hNbxz4os2fm3cl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md border border-primary bg-background px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-primary/10"
                  >
                    Yearly — €100/year (save €20)
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Data info */}
            <p className="text-xs text-muted-foreground text-center mt-8">
              Data generated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
