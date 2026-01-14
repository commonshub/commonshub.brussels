import { NextResponse } from "next/server";
import { getMonthlyReportData } from "@/lib/reports";

export const revalidate = 86400; // ISR: Revalidate every 24 hours

interface RouteParams {
  params: Promise<{
    year: string;
    month: string;
  }>;
}

/**
 * GET /api/reports/[year]/[month]
 * Returns monthly report data including active members, popular photos, and financials
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { year, month } = await params;

  // Validate year format (YYYY)
  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json(
      { error: "Invalid year format. Expected YYYY." },
      { status: 400 }
    );
  }

  // Validate month format (MM)
  if (!/^(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { error: "Invalid month format. Expected MM (01-12)." },
      { status: 400 }
    );
  }

  try {
    const reportData = getMonthlyReportData(year, month);

    return NextResponse.json(reportData, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    });
  } catch (error) {
    console.error(`Error generating monthly report for ${year}-${month}:`, error);

    return NextResponse.json(
      {
        error: "Failed to generate monthly report",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
