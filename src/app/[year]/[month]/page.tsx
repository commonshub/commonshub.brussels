import { notFound } from "next/navigation";
import { parseQuarter } from "@/lib/odoo-quarter";
import { MonthlyReportClient } from "./monthly-report-client";
import { QuarterlyReport } from "@/components/quarterly-report";
import { MemberRecap } from "@/components/recap/member-recap";
import { parsePeriod, periodName } from "@/lib/monthly-recap";

const YEAR_RE = /^20\d{2}$/;
const MONTH_RE = /^(0[1-9]|1[0-2])$/;

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

// /<username>/<year>: a member's year (the segments shift by one).
const memberYear = (first: string, second: string) => (/^\d{4}$/.test(first) ? null : parsePeriod(second));

export async function generateMetadata({ params }: PageProps) {
  const { year, month } = await params;
  const period = memberYear(year, month);
  return period ? { title: `${periodName(period)} at the Commons Hub`, robots: { index: false } } : {};
}

export default async function YearMonthPage({ params }: PageProps) {
  const { year, month } = await params;

  const period = memberYear(year, month);
  if (period) {
    return <MemberRecap username={year} period={period} />;
  }

  if (!YEAR_RE.test(year)) {
    notFound();
  }

  const quarter = parseQuarter(month);
  if (quarter !== null) {
    return <QuarterlyReport year={year} quarter={quarter} />;
  }

  if (!MONTH_RE.test(month)) {
    notFound();
  }

  return <MonthlyReportClient />;
}
