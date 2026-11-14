import Link from "next/link"
import { FileCode2, Landmark } from "lucide-react"

import { type Settlement, matchVatPayments } from "@/lib/taxes"
import { loadTaxPayments, loadVatReturns } from "@/lib/taxes-data"
import { filingsOf, findPeriod, returnOverdue } from "@/lib/vat-position"
import { quarterHasData, vatXmlExists } from "@/lib/vat-position-data"

type Lang = "en" | "fr"

const T = {
  en: {
    vat: "VAT",
    allTaxes: "All taxes",
    filed: (many: boolean, num: string) => `The quarterly VAT ${many ? "returns" : "return"} as filed with the FPS Finance (Intervat)${num ? `, VAT number ${num}` : ""}.`,
    q: (q: number) => `Q${q}`,
    title: (year: number, q?: number) => (q ? `${year} Q${q}` : `${year}`),
    noReturn: "No VAT return on file for this quarter",
    owedToUs: "owed to us",
    dueToState: "due to the State",
    nothingDue: "nothing due",
    collected: (c: string, d: string) => `${c} collected, ${d} deducted`,
    corrected: (n: number) => `corrected (${n} earlier ${n === 1 ? "filing" : "filings"} replaced)`,
    xml: "Return as filed (XML)",
    noXml: "XML not published yet",
    notRefunded: "Not refunded: carried forward",
    noPayment: "No payment found",
    settledOn: (refund: boolean, dates: string) => `${refund ? "Refunded" : "Paid"} on ${dates}`,
    partial: (amount: string, refund: boolean, dates: string, missing: string) => `${amount} ${refund ? "refunded" : "paid"} on ${dates}, ${missing} not found`,
  },
  fr: {
    vat: "TVA",
    allTaxes: "Toutes les taxes",
    filed: (many: boolean, num: string) => `${many ? "Les déclarations TVA trimestrielles" : "La déclaration TVA trimestrielle"} telle${many ? "s" : ""} que déposée${many ? "s" : ""} au SPF Finances (Intervat)${num ? `, numéro de TVA ${num}` : ""}.`,
    q: (q: number) => `T${q}`,
    title: (year: number, q?: number) => (q ? `T${q} ${year}` : `${year}`),
    noReturn: "Aucune déclaration TVA disponible pour ce trimestre",
    owedToUs: "dû à nous",
    dueToState: "dû à l'État",
    nothingDue: "rien à payer",
    collected: (c: string, d: string) => `${c} perçus, ${d} déduits`,
    corrected: (n: number) => `corrigée (${n} déclaration${n === 1 ? "" : "s"} antérieure${n === 1 ? "" : "s"} remplacée${n === 1 ? "" : "s"})`,
    xml: "Déclaration déposée (XML)",
    noXml: "XML pas encore publié",
    notRefunded: "Pas remboursé : reporté",
    noPayment: "Aucun paiement trouvé",
    settledOn: (refund: boolean, dates: string) => `${refund ? "Remboursé" : "Payé"} le ${dates}`,
    partial: (amount: string, refund: boolean, dates: string, missing: string) => `${amount} ${refund ? "remboursés" : "payés"} le ${dates}, ${missing} non trouvés`,
  },
}

function settledText(net: number, s: Settlement | undefined, lang: Lang, eur: (n: number) => string, shortDate: (iso: string) => string): string {
  const t = T[lang]
  if (!s || s.status === "nothing-due") return ""
  if (s.status === "none") return net < 0 ? t.notRefunded : t.noPayment
  const dates = s.payments.map((p) => shortDate(p.date)).join(", ")
  if (s.status === "partial") return t.partial(eur(Math.abs(s.payments.reduce((sum, p) => sum + p.amount, 0))), net < 0, dates, eur(Math.abs(s.missing)))
  return t.settledOn(net < 0, dates)
}

/**
 * The VAT return(s) of a quarter, or of every quarter of a year: what we
 * declared, how it was settled, and the return itself as filed (XML).
 * A quarter whose return should be in by now but isn't on file says so.
 */
export function VatBox({ year, quarter, now = new Date(), lang = "en" }: { year: number; quarter?: number; now?: Date; lang?: Lang }) {
  const t = T[lang]
  const locale = lang === "fr" ? "fr-BE" : "en-GB"
  const eurF = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })
  const eur = { format: (n: number) => eurF.format(n) }
  const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const vat = loadVatReturns()
  const quarters = (quarter ? [quarter] : [1, 2, 3, 4]).filter((q) => findPeriod(vat, year, q) || (returnOverdue(year, q, now) && quarterHasData(year, q)))
  if (quarters.length === 0) return null

  const { byPeriod } = matchVatPayments(vat?.periods ?? [], loadTaxPayments())

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-labelledby={`vat-${year}-${quarter ?? "year"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`vat-${year}-${quarter ?? "year"}`} className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Landmark className="h-5 w-5 text-primary" /> {t.vat} {t.title(year, quarter)}
        </h3>
        <Link href="/taxes" className="text-sm text-primary underline-offset-2 hover:underline">
          {t.allTaxes}
        </Link>
      </header>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.filed(quarters.length > 1, vat?.vatNumber ?? "")}
      </p>

      <ul className="mt-4 divide-y divide-border">
        {quarters.map((q) => {
          const period = findPeriod(vat, year, q)
          if (!period) {
            return (
              <li key={q} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <span className="font-medium text-foreground">{t.q(q)}</span>
                <span className="text-sm text-amber-700 dark:text-amber-400">{t.noReturn}</span>
              </li>
            )
          }
          const net = period.totals.net
          const filings = filingsOf(period)
          const current = filings[0]
          const xml = current && vatXmlExists(year, q, current.statementId)
          const settled = settledText(net, byPeriod.get(period.period), lang, eur.format, shortDate)
          return (
            <li key={q} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 py-3 sm:grid-cols-[auto_1fr_auto]">
              <span className="font-medium text-foreground">{t.q(q)}</span>
              <div className="min-w-0 text-right sm:text-left">
                <span className={`font-semibold tabular-nums ${net < 0 ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                  {net < 0 ? `−${eur.format(-net)}` : eur.format(net)}
                </span>{" "}
                <span className="text-sm text-muted-foreground">{net < 0 ? t.owedToUs : net > 0 ? t.dueToState : t.nothingDue}</span>
                <div className="text-xs text-muted-foreground">
                  {t.collected(eur.format(period.totals.outputVat), eur.format(period.totals.inputVat))}
                  {settled ? ` · ${settled}` : ""}
                  {filings.length > 1 ? ` · ${t.corrected(filings.length - 1)}` : ""}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:text-right">
                {xml ? (
                  <a href={`/${year}/Q${q}/vat.xml`} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
                    <FileCode2 className="h-4 w-4" /> {t.xml}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">{t.noXml}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
