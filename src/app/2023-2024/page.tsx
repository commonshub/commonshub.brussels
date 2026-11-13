import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { VatBox } from "@/components/vat-box"
import { matchVatPayments } from "@/lib/taxes"
import { loadTaxPayments, loadVatReturns } from "@/lib/taxes-data"
import {
  BUCKETS,
  BUCKET_ORDER,
  OTHER_LABELS,
  type QuarterIncome,
  declaredSalesVat,
  expectedSalesVat,
  findPeriod,
  incomeByQuarter,
  quarterKey,
  returnOverdue,
  vatIncluded,
} from "@/lib/vat-position"
import { firstMonthByAccount, loadTransactions, quarterHasData } from "@/lib/vat-position-data"

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "VAT 2023–2024 | Commons Hub Brussels",
  description: "Our VAT position for 2023 and 2024: what we declared and paid each quarter, what our income says we should have charged, and the difference.",
}

const YEARS = [2023, 2024]
const BANK_ACCOUNT = "kbc"
const monthName = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" })
const signed = (n: number) => (n < 0 ? `−${eur.format(-n)}` : eur.format(n))
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const round = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => round(xs.reduce((s, x) => s + x, 0))

export default function Vat20232024Page() {
  const now = new Date()
  const vat = loadVatReturns()
  const txs = loadTransactions(YEARS)
  const income = incomeByQuarter(txs)
  // Our main bank account: when its statements start after these years, what came in there is missing.
  const bankFrom = firstMonthByAccount([...YEARS, YEARS[YEARS.length - 1] + 1]).get(BANK_ACCOUNT)
  const bankMissing = !bankFrom || bankFrom > `${YEARS[YEARS.length - 1]}-12`
  const yearsWithoutData = YEARS.filter((y) => !txs.some((t) => new Date(t.timestamp * 1000).getUTCFullYear() === y))
  const { byPeriod } = matchVatPayments(vat?.periods ?? [], loadTaxPayments())

  // The quarters we report on: those with a return, or with data in the dataset.
  const quarters = YEARS.flatMap((y) => [1, 2, 3, 4].map((q) => ({ y, q })))
    .filter(({ y, q }) => findPeriod(vat, y, q) || quarterHasData(y, q))
    .map(({ y, q }) => {
      const key = quarterKey(y, q)
      const period = findPeriod(vat, y, q)
      const inc: QuarterIncome | undefined = income.get(key)
      const expected = expectedSalesVat(inc)
      const declared = period ? declaredSalesVat(period) : 0
      const settlement = period ? byPeriod.get(period.period) : undefined
      const settledAmount = settlement && settlement.status !== "none" ? sum(settlement.payments.map((p) => p.amount)) : 0
      return {
        key,
        label: `${y} Q${q}`,
        period,
        missing: !period && returnOverdue(y, q, now),
        income: inc?.total ?? 0,
        expected,
        declared,
        delta: round(expected - declared),
        net: period?.totals.net ?? 0,
        settlement,
        settledAmount,
      }
    })

  const all = [...income.values()].filter((i) => YEARS.includes(Number(i.quarter.slice(0, 4))))
  const byBucket = BUCKET_ORDER.map((b) => {
    const amount = sum(all.map((i) => i.byBucket[b]))
    const rate = BUCKETS[b].rate
    return { bucket: b, ...BUCKETS[b], amount, expected: rate ? vatIncluded(amount, rate) : rate === 0 ? 0 : null }
  })
  const other = Object.entries(
    all.reduce<Record<string, number>>((acc, i) => {
      for (const [cat, v] of Object.entries(i.other)) acc[cat] = round((acc[cat] ?? 0) + v)
      return acc
    }, {}),
  ).sort((a, b) => b[1] - a[1])
  const uncategorised = other.find(([c]) => c === "")?.[1] ?? 0

  const totalIncome = sum(byBucket.map((b) => b.amount))
  const totalExpected = sum(quarters.map((q) => q.expected))
  const totalDeclared = sum(quarters.map((q) => q.declared))
  const totalDelta = round(totalExpected - totalDeclared)
  const totalNet = sum(quarters.map((q) => q.net))
  const totalSettled = sum(quarters.map((q) => q.settledAmount))
  const missing = quarters.filter((q) => q.missing)

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-12 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Taxes</p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-foreground">VAT 2023–2024</h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
            Our VAT position for 2023 and 2024: what we declared and paid each quarter, what the income in our accounts says we should have charged, and the difference.
          </p>

          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <dt className="text-sm text-muted-foreground">VAT we should have charged on sales</dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums">{eur.format(totalExpected)}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <dt className="text-sm text-muted-foreground">VAT on sales we declared</dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums">{eur.format(totalDeclared)}</dd>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <dt className="text-sm text-muted-foreground">Difference</dt>
              <dd className={`mt-1 text-3xl font-bold tabular-nums ${totalDelta > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{signed(totalDelta)}</dd>
              <dd className="text-xs text-muted-foreground">{totalDelta > 0 ? "declared less than our income suggests" : "declared at least what our income suggests"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            After deducting the VAT we paid on purchases, the returns for these years come to <span className="font-semibold text-foreground tabular-nums">{signed(totalNet)}</span>{" "}
            ({totalNet < 0 ? "owed to us" : "due to the State"}); {totalSettled === 0 ? "nothing has been paid or refunded on them" : `${signed(totalSettled)} was ${totalSettled < 0 ? "refunded" : "paid"} on them`}.
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-14">
          {(bankMissing || yearsWithoutData.length > 0) && (
            <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Some of our accounts are not in the dataset for these years
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {bankMissing && (
                  <li>
                    Our KBC bank account&apos;s transactions start {bankFrom ? `in ${monthName(bankFrom)}` : "later"}. What came in there in these years (income, and VAT refunds) is not counted on this page yet.
                  </li>
                )}
                {yearsWithoutData.length > 0 && <li>No transactions at all for {yearsWithoutData.join(" and ")} yet.</li>}
              </ul>
              <p className="mt-1">The figures below will move once those statements are imported.</p>
            </div>
          )}

          {missing.length > 0 && (
            <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" /> No VAT return on file for {missing.map((q) => q.label).join(" and ")}
              </p>
              <p className="mt-1">
                Either it was not filed, or it has not been imported yet. The VAT expected on those quarters&apos; income counts in full in the difference above.
              </p>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-foreground">Quarter by quarter</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              &quot;Should have charged&quot; applies the rates below to the money we received that quarter. &quot;Declared&quot; is the VAT on sales in the return (grid 54, less grid 64).
            </p>
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Quarter</th>
                    <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Income</th>
                    <th className="px-3 py-2 text-right font-medium">Should have charged</th>
                    <th className="px-3 py-2 text-right font-medium">Declared</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Difference</th>
                    <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">Return result</th>
                    <th className="hidden px-3 py-2 font-medium lg:table-cell">Paid / refunded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quarters.map((q) => (
                    <tr key={q.key} className="align-top">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        <Link href={`/${q.key.replace("-", "/")}`} className="hover:underline">
                          {q.label}
                        </Link>
                        {q.missing && <div className="text-xs font-normal text-amber-700 dark:text-amber-400">no return on file</div>}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground md:table-cell">{eur.format(q.income)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{eur.format(q.expected)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{q.period ? eur.format(q.declared) : "—"}</td>
                      <td className={`hidden px-3 py-2 text-right tabular-nums sm:table-cell ${q.delta > 0 ? "text-amber-700 dark:text-amber-400" : ""}`}>{signed(q.delta)}</td>
                      <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">
                        {q.period ? (
                          <span className={q.net < 0 ? "text-green-700 dark:text-green-400" : ""}>{signed(q.net)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="hidden px-3 py-2 text-muted-foreground lg:table-cell">
                        {!q.settlement || q.settlement.status === "nothing-due"
                          ? "—"
                          : q.settlement.status === "none"
                            ? q.net < 0
                              ? "Not refunded: carried forward"
                              : "No payment found"
                            : q.settlement.payments.map((p) => `${signed(p.amount)} on ${shortDate(p.date)}`).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{eur.format(totalIncome)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(totalExpected)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(totalDeclared)}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{signed(totalDelta)}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{signed(totalNet)}</td>
                    <td className="hidden px-3 py-2 tabular-nums lg:table-cell">{signed(totalSettled)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground sm:hidden">Turn your phone sideways for the difference and how each return was settled.</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Income by category</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Everything that came into our accounts in 2023 and 2024 from outside (moves between our own accounts left out), and the VAT it should carry. Amounts received include the VAT.
            </p>
            <div className="mt-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Rate</th>
                    <th className="px-3 py-2 text-right font-medium">VAT in it</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byBucket.map((b) => (
                    <tr key={b.bucket} className="align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{b.label}</div>
                        <div className="text-xs text-muted-foreground">{b.why}</div>
                        {b.bucket === "other" && other.length > 0 && (
                          <ul className="mt-1 text-xs text-muted-foreground">
                            {other.map(([cat, v]) => (
                              <li key={cat || "none"} className="flex justify-between gap-3">
                                <span>{OTHER_LABELS[cat] ?? cat}</span>
                                <span className="tabular-nums">{eur.format(v)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{eur.format(b.amount)}</td>
                      <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{b.rate === null ? "—" : `${Math.round(b.rate * 100)}%`}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.expected === null ? "—" : eur.format(b.expected)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(totalIncome)}</td>
                    <td className="hidden px-3 py-2 sm:table-cell" />
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(totalExpected)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="max-w-3xl space-y-3 text-sm text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">How to read this</h2>
            <p>
              This is an estimate from the money received, not from our invoices. A return counts an invoice when it is issued, so income can fall in the quarter after the one that declared it: compare the totals rather than single quarters.
            </p>
            <p>
              &quot;Other income&quot; is left out of the estimate. {uncategorised > 0 && `${eur.format(uncategorised)} of it is not categorised yet: it includes loans and capital contributions (no VAT) as well as paid invoices for room rentals (VAT due). Were all of it taxable at 21%, ${eur.format(vatIncluded(uncategorised, 0.21))} more VAT would be due. `}
              Token top-ups are prepaid credit: the VAT is due on what the tokens buy, not on the top-up.
            </p>
            <p>
              The returns also declare sales without Belgian VAT: services to customers in other EU countries (grid 44) and operations outside its scope (grid 47). Grants invoiced to foreign funders fall there.
            </p>
            <p>
              Every amount comes from the{" "}
              <Link href="/integrity" className="underline underline-offset-2">
                public dataset
              </Link>{" "}
              and the returns from Intervat; see also <Link href="/taxes" className="underline underline-offset-2">all our taxes</Link>.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {YEARS.map((y) => (
              <VatBox key={y} year={y} now={now} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
