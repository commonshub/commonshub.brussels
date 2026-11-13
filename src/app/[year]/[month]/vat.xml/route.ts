import * as fs from "fs"
import { NextRequest, NextResponse } from "next/server"
import { parseQuarter } from "@/lib/odoo-quarter"
import { loadVatReturns } from "@/lib/taxes-data"
import { filingsOf, findPeriod, redactDeclarant } from "@/lib/vat-position"
import { vatXmlFile } from "@/lib/vat-position-data"

export const dynamic = "force-dynamic"

/**
 * /<year>/Q<n>/vat.xml: the quarter's VAT return as downloaded from Intervat
 * (the current filing; ?statement=<id> for one it replaced).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ year: string; month: string }> }) {
  const { year, month } = await params
  const quarter = parseQuarter(month)
  if (!/^20\d{2}$/.test(year) || quarter === null) return new NextResponse("Not found", { status: 404 })

  const period = findPeriod(loadVatReturns(), Number(year), quarter)
  const filings = period ? filingsOf(period) : []
  const wanted = request.nextUrl.searchParams.get("statement")
  const filing = wanted ? filings.find((f) => f.statementId === wanted) : filings[0]
  const file = filing && vatXmlFile(Number(year), quarter, filing.statementId)
  if (!file || !fs.existsSync(file)) return new NextResponse("No VAT return published for this quarter", { status: 404 })

  return new NextResponse(redactDeclarant(fs.readFileSync(file, "utf-8")), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `inline; filename="vat-${year}-Q${quarter}-${filing.statementId}.xml"`,
      "Cache-Control": "public, max-age=3600",
    },
  })
}
