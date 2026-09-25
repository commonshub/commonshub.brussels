import Link from "next/link"
import { Building2, ChevronDown, Landmark, MapPinned } from "lucide-react"

import { PASS_THROUGH, loadTaxPayments } from "@/lib/taxes-data"
import { type TaxLevel, type TaxPayment, summarizeTaxes } from "@/lib/taxes"

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Taxes | Commons Hub Brussels",
  description: "How much the Commons Hub pays in taxes: the City of Brussels, the Brussels Region and the federal state.",
}

const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" })
const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
const quarterLabel = (q: string) => q.replace("-", " ")

const LEVEL_INFO: Record<TaxLevel, { title: string; who: string; what: string; icon: typeof Landmark }> = {
  local: {
    title: "Local",
    who: "City of Brussels",
    what: "Office tax (taxe sur les bureaux), levied on the building's owner and passed through to us for our share of the building.",
    icon: MapPinned,
  },
  regional: {
    title: "Regional",
    who: "Brussels-Capital Region",
    what: "Property tax (précompte immobilier), levied on the building's owner and passed through to us for our share of the building.",
    icon: Building2,
  },
  federal: {
    title: "Federal",
    who: "Federal state (FPS Finance)",
    what: "VAT, settled every quarter: a payment when we collected more VAT than we paid, a refund when we paid more than we collected.",
    icon: Landmark,
  },
}

function Signed({ amount }: { amount: number }) {
  return (
    <span className={`tabular-nums ${amount < 0 ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
      {amount < 0 ? `−${eur.format(-amount)}` : eur.format(amount)}
    </span>
  )
}

function PaymentList({ payments }: { payments: TaxPayment[] }) {
  return (
    <ul className="mt-3 divide-y divide-border text-sm">
      {payments.map((p) => {
        const [y, m] = p.date.split("-")
        return (
          <li key={p.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="text-foreground">
                {p.kind === "vat" ? `VAT ${quarterLabel(p.quarter!)} ${p.amount < 0 ? "refund" : "payment"}` : `${p.label}${p.taxYear ? ` ${p.taxYear}` : ""}`}
              </div>
              <Link href={`/${y}/${m}/transactions`} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                {longDate(p.date)}
              </Link>
            </div>
            <Signed amount={p.amount} />
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Taxes, for transparency: what the Commons Hub has paid, to whom, and how
 * the owner's taxes are shared out. Every figure comes from the bank
 * movements in the public dataset, so it moves as soon as a payment does.
 */
export default function TaxesPage() {
  const summary = summarizeTaxes(loadTaxPayments())
  const pt = PASS_THROUGH
  const propertyShare = pt.cadastralIncome.ours / pt.cadastralIncome.building
  const officeShare = pt.cadastralIncome.ours / pt.cadastralIncome.officeTaxBase
  const passThroughTotal = pt.propertyTax.ours + pt.officeTax.ours

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground">Taxes</h1>
          <p className="mt-6 max-w-3xl text-xl text-muted-foreground">
            A commons still pays its share. Here is everything the Commons Hub has paid in taxes, to the City, the Region and the federal state.
          </p>
          <div className="mt-10">
            <div className="text-5xl sm:text-6xl font-bold tabular-nums text-foreground">{eur.format(summary.total)}</div>
            <p className="mt-2 text-muted-foreground">
              paid in taxes{summary.since ? ` since ${longDate(summary.since)}` : ""}, VAT refunds deducted.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-16">
          <div>
            <h2 className="text-2xl font-bold text-foreground">By level of government</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {summary.levels.map(({ level, total, payments }) => {
                const info = LEVEL_INFO[level]
                const Icon = info.icon
                return (
                  <div key={level} className="flex flex-col rounded-lg border border-border bg-card p-6">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
                      <Icon className="h-4 w-4" />
                      {info.title}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{info.who}</div>
                    <div className="mt-4 text-3xl font-bold">
                      <Signed amount={total} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{info.what}</p>
                    {payments.length > 0 && (
                      <details className="group mt-4">
                        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary">
                          {payments.length} {payments.length === 1 ? "payment" : "payments"}
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </summary>
                        <PaymentList payments={payments} />
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">VAT, quarter by quarter</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Every quarter we file a VAT return. When we collected more VAT on our invoices than we paid on our expenses, we pay the difference; when we paid more, the state refunds it. Refunds are shown in green, with a minus sign.
            </p>
            {summary.vatQuarters.length > 0 ? (
              <div className="mt-6 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Quarter</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Settled</th>
                      <th className="px-4 py-2 font-medium">Result</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.vatQuarters.map((q) => (
                      <tr key={q.quarter}>
                        <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">
                          {quarterLabel(q.quarter)}
                          <div className="text-xs font-normal text-muted-foreground sm:hidden">{q.payments.map((p) => longDate(p.date)).join(", ")}</div>
                        </td>
                        <td className="hidden px-4 py-2 text-muted-foreground whitespace-nowrap sm:table-cell">{q.payments.map((p) => longDate(p.date)).join(", ")}</td>
                        <td className="px-4 py-2 text-muted-foreground">{q.amount < 0 ? "Refunded to us" : "Paid"}</td>
                        <td className="px-4 py-2 text-right">
                          <Signed amount={q.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">No VAT settlement in the data yet.</p>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">How the building&apos;s taxes are shared</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              The property tax and the office tax are levied on the owner of the building, who passes our share on to us. The share follows the cadastral income (revenu cadastral) of the floors we occupy: {eur0.format(pt.cadastralIncome.ours)} of the building&apos;s {eur0.format(pt.cadastralIncome.building)}. The office tax leaves out the ground-floor shop and the basement, so our share of it is larger.
            </p>
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{pt.year}</th>
                    <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Whole building</th>
                    <th className="px-4 py-2 text-right font-medium">Our share</th>
                    <th className="px-4 py-2 text-right font-medium">We pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2 text-foreground">Property tax (regional)</td>
                    <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{eur.format(pt.propertyTax.building)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pct(propertyShare)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{eur.format(pt.propertyTax.ours)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-foreground">Office tax (local)</td>
                    <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{eur.format(pt.officeTax.building)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pct(officeShare)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{eur.format(pt.officeTax.ours)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="px-4 py-2 text-foreground">Total</td>
                    <td className="hidden px-4 py-2 sm:table-cell" />
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right tabular-nums">{eur.format(passThroughTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              That is about {eur0.format(passThroughTotal / 12)} a month. It is counted in the total above once the owner bills it and we pay.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Every payment above comes from the Commons Hub&apos;s own bank movements in the{" "}
            <Link href="/integrity" className="underline underline-offset-2">
              public dataset
            </Link>
            ; each date links to that month&apos;s transactions.
          </p>
        </div>
      </section>
    </main>
  )
}
