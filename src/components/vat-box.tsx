import Link from "next/link"
import { FileCode2, Landmark } from "lucide-react"

import { type Settlement, matchVatPayments } from "@/lib/taxes"
import { loadTaxPayments, loadVatReturns } from "@/lib/taxes-data"
import { filingsOf, findPeriod, returnOverdue } from "@/lib/vat-position"
import { quarterHasData, vatXmlExists } from "@/lib/vat-position-data"

const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" })
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

function settledText(net: number, s: Settlement | undefined): string {
  if (!s || s.status === "nothing-due") return ""
  if (s.status === "none") return net < 0 ? "Not refunded: carried forward" : "No payment found"
  const dates = s.payments.map((p) => shortDate(p.date)).join(", ")
  if (s.status === "partial") return `${eur.format(Math.abs(s.payments.reduce((t, p) => t + p.amount, 0)))} ${net < 0 ? "refunded" : "paid"} on ${dates}, ${eur.format(Math.abs(s.missing))} not found`
  return `${net < 0 ? "Refunded" : "Paid"} on ${dates}`
}

/**
 * The VAT return(s) of a quarter, or of every quarter of a year: what we
 * declared, how it was settled, and the return itself as filed (XML).
 * A quarter whose return should be in by now but isn't on file says so.
 */
export function VatBox({ year, quarter, now = new Date() }: { year: number; quarter?: number; now?: Date }) {
  const vat = loadVatReturns()
  const quarters = (quarter ? [quarter] : [1, 2, 3, 4]).filter((q) => findPeriod(vat, year, q) || (returnOverdue(year, q, now) && quarterHasData(year, q)))
  if (quarters.length === 0) return null

  const { byPeriod } = matchVatPayments(vat?.periods ?? [], loadTaxPayments())

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby={`vat-${year}-${quarter ?? "year"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`vat-${year}-${quarter ?? "year"}`} className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Landmark className="h-5 w-5 text-primary" /> VAT {quarter ? `${year} Q${quarter}` : year}
        </h3>
        <Link href="/taxes" className="text-sm text-primary underline-offset-2 hover:underline">
          All taxes
        </Link>
      </header>
      <p className="mt-1 text-sm text-muted-foreground">
        The quarterly VAT {quarters.length > 1 ? "returns" : "return"} as filed with the FPS Finance (Intervat){vat ? `, VAT number ${vat.vatNumber}` : ""}.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {quarters.map((q) => {
          const period = findPeriod(vat, year, q)
          if (!period) {
            return (
              <li key={q} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <span className="font-medium text-foreground">Q{q}</span>
                <span className="text-sm text-amber-700 dark:text-amber-400">No VAT return on file for this quarter</span>
              </li>
            )
          }
          const net = period.totals.net
          const filings = filingsOf(period)
          const current = filings[0]
          const xml = current && vatXmlExists(year, q, current.statementId)
          const settled = settledText(net, byPeriod.get(period.period))
          return (
            <li key={q} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 py-3 sm:grid-cols-[auto_1fr_auto]">
              <span className="font-medium text-foreground">Q{q}</span>
              <div className="min-w-0 text-right sm:text-left">
                <span className={`font-semibold tabular-nums ${net < 0 ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                  {net < 0 ? `−${eur.format(-net)}` : eur.format(net)}
                </span>{" "}
                <span className="text-sm text-muted-foreground">{net < 0 ? "owed to us" : net > 0 ? "due to the State" : "nothing due"}</span>
                <div className="text-xs text-muted-foreground">
                  {eur.format(period.totals.outputVat)} collected, {eur.format(period.totals.inputVat)} deducted
                  {settled ? ` · ${settled}` : ""}
                  {filings.length > 1 ? ` · corrected (${filings.length - 1} earlier ${filings.length === 2 ? "filing" : "filings"} replaced)` : ""}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:text-right">
                {xml ? (
                  <a href={`/${year}/Q${q}/vat.xml`} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
                    <FileCode2 className="h-4 w-4" /> Return as filed (XML)
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">XML not published yet</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
