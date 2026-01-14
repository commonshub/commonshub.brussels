import { NextResponse } from "next/server";
import { getYearlyReportData } from "@/lib/reports";

export const revalidate = 86400; // ISR: Revalidate every 24 hours

interface RouteParams {
  params: Promise<{
    year: string;
  }>;
}

/**
 * GET /api/reports/[year]
 * Returns yearly report data including active members, popular photos, financials, and monthly breakdown
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { year } = await params;

  // Validate year format (YYYY)
  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json(
      { error: "Invalid year format. Expected YYYY." },
      { status: 400 }
    );
  }

  try {
    const reportData = getYearlyReportData(year);

    return NextResponse.json(reportData, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    });
  } catch (error) {
    console.error(`Error generating yearly report for ${year}:`, error);

    return NextResponse.json(
      {
        error: "Failed to generate yearly report",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
