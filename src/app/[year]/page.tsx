import { notFound } from "next/navigation";
import { AnnualAccountsSection } from "@/components/annual-accounts";
import { readAnnualAccounts } from "@/lib/annual-accounts";
import { YearlyReportClient } from "./yearly-report-client";
import { resolveAlias } from "@/lib/member-pages";
import { pageSegment } from "@/lib/member-pages-bridge";
import { MemberPageView } from "@/components/member-page/member-page-view";

// The annual accounts are read from the dataset at request time.
export const dynamic = "force-dynamic";

const YEAR_RE = /^20\d{2}$/;

interface PageProps {
  params: Promise<{ year: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { year } = await params;
  if (YEAR_RE.test(year)) return {};
  const page = resolveAlias(pageSegment(year).slug);
  return page ? { title: `${page.title} | Commons Hub Brussels`, ...(page.visibility === "public" && page.description ? { description: page.description } : {}) } : {};
}

export default async function YearPage({ params }: PageProps) {
  const { year } = await params;
  if (!YEAR_RE.test(year)) {
    // Not a year: maybe the short address a steward gave a member's page.
    const { slug, fullScreen } = pageSegment(year);
    const page = resolveAlias(slug);
    if (page) return <MemberPageView page={page} fullScreen={fullScreen} />;
    notFound();
  }
  return (
    <YearlyReportClient>
      <AnnualAccountsSection fiscalYears={readAnnualAccounts(year)} />
    </YearlyReportClient>
  );
}
