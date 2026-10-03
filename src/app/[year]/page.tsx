import { notFound } from "next/navigation";
import { AnnualAccountsSection } from "@/components/annual-accounts";
import { readAnnualAccounts } from "@/lib/annual-accounts";
import { YearlyReportClient } from "./yearly-report-client";

// The annual accounts are read from the dataset at request time.
export const dynamic = "force-dynamic";

const YEAR_RE = /^20\d{2}$/;

interface PageProps {
  params: Promise<{ year: string }>;
}

export default async function YearPage({ params }: PageProps) {
  const { year } = await params;
  if (!YEAR_RE.test(year)) {
    notFound();
  }
  return (
    <YearlyReportClient>
      <AnnualAccountsSection fiscalYears={readAnnualAccounts(year)} />
    </YearlyReportClient>
  );
}
