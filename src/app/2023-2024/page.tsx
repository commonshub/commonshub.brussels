import Link from "next/link"
import { AlertTriangle, ChevronDown, ReceiptText } from "lucide-react"

import { VatBox } from "@/components/vat-box"
import { explorerTxUrl, matchVatPayments } from "@/lib/taxes"
import { loadTaxPayments, loadVatReturns } from "@/lib/taxes-data"
import {
  type CategoryLine,
  itemsLabel,
  LARGE,
  RATE_CLASSES,
  type Side,
  declaredInputVat,
  declaredSalesVat,
  findPeriod,
  quarterKey,
  returnOverdue,
  subjectToVat,
  VAT_REGISTERED_SINCE,
  vatPosition,
} from "@/lib/vat-position"
import { firstMonthByAccount, loadTransactions, quarterHasData } from "@/lib/vat-position-data"

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "VAT 2023–2024 | Commons Hub Brussels",
  description: "Our VAT position for 2023 and 2024: the VAT in what came in and went out, by rate and why, and the balance with the State.",
}

const YEARS = [2023, 2024]
const BANK_ACCOUNT = "kbc"
const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" })
const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const signed = (n: number) => (n < 0 ? `−${eur.format(-n)}` : eur.format(n))
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const monthName = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
const round = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => round(xs.reduce((s, x) => s + x, 0))

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" | "good" }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl ${tone === "warn" ? "text-amber-700 dark:text-amber-400" : tone === "good" ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
        {value}
      </div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

/** One side (income or expenses): a row per VAT rate, opening onto its categories and why that rate. */
function RateBreakdown({ side }: { side: Side }) {
  return (
    <div className="mt-6 divide-y divide-border rounded-lg border border-border">
      {side.groups.map((g) => (
        <details key={g.rate} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/40">
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            <span className="min-w-0 flex-1 font-medium text-foreground">{RATE_CLASSES[g.rate].label}</span>
            <span className="text-right tabular-nums">
              {eur.format(g.amount)}
              <span className="block text-xs text-muted-foreground">{g.vat === null ? "VAT not estimated" : `${eur.format(g.vat)} VAT`}</span>
            </span>
          </summary>
          <ul className="divide-y divide-border bg-muted/20 text-sm">
            {g.lines.map((l) => (
              <li key={l.category || "none"} className="px-4 py-3 sm:pl-11">
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{l.label}</div>
                    <div className="text-xs text-muted-foreground">{l.why}</div>
                  </div>
                  <div className="text-right tabular-nums">
                    {eur.format(l.amount)}
                    <span className="block text-xs text-muted-foreground">
                      {l.vat === null ? `${l.count} ${l.count === 1 ? "payment" : "payments"}` : `${eur.format(l.vat)} VAT`}
                    </span>
                  </div>
                </div>
                <LargeItems line={l} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}

/** The payments of a category large enough to justify one by one, each linked to where it can be checked and annotated. */
function LargeItems({ line }: { line: CategoryLine }) {
  if (line.items.length === 0) return null
  const listed = sum(line.items.map((i) => i.amount))
  const rest = round(line.amount - listed)
  const others = line.count - line.items.length
  return (
    <details className="group/items mt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/items:rotate-180" />
        {itemsLabel(line.items.map((i) => i.amount))}
      </summary>
      <ul className="mt-2 space-y-2 border-l-2 border-border pl-2 text-xs">
        {line.items.map((i, n) => (
          <li key={`${i.href}-${n}`} className="flex gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1 leading-5 text-foreground">
                <Link href={i.href} className="group/date inline-flex items-center gap-1 hover:text-primary" title="Open the transaction: check it and annotate it">
                  <ReceiptText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="underline decoration-dotted underline-offset-2">{shortDate(i.date)}</span>
                </Link>
                {i.collective ? <span className="text-muted-foreground">· {i.collective}</span> : null}
              </div>
              {(i.note || i.description) && <div className="break-words text-muted-foreground">{i.note || i.description}</div>}
            </div>
            <div className="leading-5 tabular-nums text-foreground">{eur.format(i.amount)}</div>
          </li>
        ))}
        {others > 0 && (
          <li className="flex gap-3 text-muted-foreground">
            <div className="flex-1">
              and {others} smaller {others === 1 ? "payment" : "payments"}
            </div>
            <div className="tabular-nums">{eur.format(rest)}</div>
          </li>
        )}
      </ul>
    </details>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-border pt-1 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${tone === "good" ? "text-green-700 dark:text-green-400" : ""}`}>{value}</dd>
    </div>
  )
}

export default function Vat20232024Page() {
  const now = new Date()
  const vat = loadVatReturns()
  const lastYear = YEARS[YEARS.length - 1]
  const txs = loadTransactions([...YEARS, lastYear + 1])
  const position = vatPosition(txs, YEARS, explorerTxUrl)
  const { byPeriod } = matchVatPayments(vat?.periods ?? [], loadTaxPayments())

  // An account whose history starts after these years: what came in or went out there is missing.
  const bankFrom = firstMonthByAccount([...YEARS, lastYear + 1]).get(BANK_ACCOUNT)
  const bankMissing = !bankFrom || bankFrom > `${lastYear}-12`
  const yearsWithoutData = YEARS.filter((y) => !txs.some((t) => new Date(t.timestamp * 1000).getUTCFullYear() === y))

  const quarters = YEARS.flatMap((y) => [1, 2, 3, 4].map((q) => ({ y, q })))
    .filter(({ y, q }) => findPeriod(vat, y, q) || quarterHasData(y, q))
    .map(({ y, q }) => {
      const key = quarterKey(y, q)
      const period = findPeriod(vat, y, q)
      const settlement = period ? byPeriod.get(period.period) : undefined
      return {
        key,
        label: `${y} Q${q}`,
        period,
        missing: !period && returnOverdue(y, q, now),
        est: position.quarters.get(key) ?? { collected: 0, paid: 0 },
        net: period?.totals.net ?? 0,
        settled: settlement && settlement.status !== "none" ? settlement.payments : [],
      }
    })
  const filed = quarters.filter((q) => q.period)
  const missing = quarters.filter((q) => q.missing)

  const declaredSales = sum(filed.map((q) => declaredSalesVat(q.period!)))
  const declaredInput = sum(filed.map((q) => declaredInputVat(q.period!)))
  const estBalance = round(position.income.vat - position.expense.vat)
  const owed = sum(filed.filter((q) => q.net > 0).map((q) => q.net))
  const owedToUs = sum(filed.filter((q) => q.net < 0).map((q) => -q.net))
  const net = round(owed - owedToUs)
  const paid = sum(quarters.flatMap((q) => q.settled.filter((p) => p.amount > 0).map((p) => p.amount)))
  const refunded = sum(quarters.flatMap((q) => q.settled.filter((p) => p.amount < 0).map((p) => -p.amount)))
  const open = round(net - paid + refunded)
  // Each refund or payment once, with the quarters it settled (one refund can settle several).
  const settlements = [...quarters.flatMap((q) => q.settled.map((p) => ({ p, q: q.label })))
    .reduce((acc, { p, q }) => {
      const key = `${p.id}|${p.date}`
      const e = acc.get(key) ?? { id: p.id, date: p.date, amount: 0, quarters: [] as string[] }
      e.amount = round(e.amount + p.amount)
      e.quarters.push(q)
      return acc.set(key, e)
    }, new Map<string, { id: string; date: string; amount: number; quarters: string[] }>())
    .values()].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-12 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Taxes</p>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-foreground">VAT 2023–2024</h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
            Everything that came in and went out in 2023 and 2024, by VAT regime and why, and where that leaves us with the State. Open a rate to see its categories; open a category to see every payment of {eur0.format(LARGE)} or more, with a link to annotate it. We have been subject to VAT since {new Date(`${VAT_REGISTERED_SINCE}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} (KBO/BCE record of{" "}
            <a href="https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?ondernemingsnummer=0804505132&lang=en" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">0804.505.132</a>
            ): what came in or went out before that carried no VAT.
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
          {(bankMissing || yearsWithoutData.length > 0 || missing.length > 0) && (

            <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Incomplete: these figures will move
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {bankMissing && (
                  <li>
                    Our KBC bank account&apos;s transactions start {bankFrom ? `in ${monthName(bankFrom)}` : "later"}: what came in or went out there in these years, VAT refunds included, is not counted yet.
                  </li>
                )}
                {yearsWithoutData.length > 0 && <li>No transactions at all for {yearsWithoutData.join(" and ")} yet.</li>}
                {missing.length > 0 && <li>No VAT return on file for {missing.map((q) => q.label).join(" and ")}: either not filed, or not imported yet.</li>}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-foreground">1. Income</h2>
            <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Figure label="Received" value={eur.format(position.income.amount)} note="VAT included" />
              <Figure label="VAT in it" value={eur.format(position.income.vat)} note="what we should have charged" />
              <Figure label="Declared in the returns" value={eur.format(declaredSales)} note="VAT on sales (grids 54 − 64)" tone={declaredSales < position.income.vat - 1 ? "warn" : undefined} />
            </div>
            <RateBreakdown side={position.income} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">2. Expenses</h2>
            <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Figure label="Paid" value={eur.format(position.expense.amount)} note="VAT included" />
              <Figure label="VAT in it" value={eur.format(position.expense.vat)} note="what our suppliers charged us" />
              <Figure label="Deducted in the returns" value={eur.format(declaredInput)} note="VAT on purchases (grid 59)" />
            </div>
            <RateBreakdown side={position.expense} />
            <p className="mt-3 text-sm text-muted-foreground">
              VAT on purchases can only be deducted for what serves our taxable activities. Part of what we do (donations, membership) is outside VAT, so in principle only a share of it is deductible.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">3. VAT balance</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">From our income and expenses</h3>
                <dl className="mt-3 space-y-1 text-sm">
                  <Row label="VAT in our income" value={eur.format(position.income.vat)} />
                  <Row label="VAT in our expenses" value={`−${eur.format(position.expense.vat)}`} />
                  <Row label={estBalance < 0 ? "Balance: owed to us" : "Balance: owed to the State"} value={signed(estBalance)} strong tone={estBalance < 0 ? "good" : undefined} />
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">An estimate, before limiting deductions to our taxable share.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">From the returns we filed</h3>
                <dl className="mt-3 space-y-1 text-sm">
                  <Row label={`Owed to the State (${filed.filter((q) => q.net > 0).length} quarters)`} value={eur.format(owed)} />
                  <Row label={`Owed to us (${filed.filter((q) => q.net < 0).length} quarters)`} value={owedToUs ? `−${eur.format(owedToUs)}` : eur.format(0)} tone="good" />
                  <Row label="Balance" value={signed(net)} strong tone={net < 0 ? "good" : undefined} />
                  <Row label="Paid by us" value={paid ? `−${eur.format(paid)}` : eur.format(0)} />
                  <Row label="Refunded to us" value={refunded ? `+${eur.format(refunded)}` : eur.format(0)} />
                  <Row label={open < 0 ? "Still owed to us" : open > 0 ? "Still owed to the State" : "Still open"} value={signed(open)} strong tone={open < 0 ? "good" : undefined} />
                </dl>
                {settlements.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
                    {settlements.map((s) => {
                      const onChain = explorerTxUrl(s.id)
                      const [y, m] = s.date.split("-")
                      return (
                        <li key={`${s.id}${s.date}`} className="flex justify-between gap-3">
                          <span>
                            {s.amount < 0 ? "Refunded" : "Paid"} on{" "}
                            <a href={onChain ?? `/${y}/${m}/transactions?category=vat`} className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                              {shortDate(s.date)}
                            </a>{" "}
                            for {s.quarters.join(" + ")}
                          </span>
                          <span className="tabular-nums">{eur.format(Math.abs(s.amount))}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {open < 0 ? "Not refunded in the accounts we have: carried forward on our VAT account, or refunded to an account not imported yet." : open > 0 ? "Not paid from the accounts we have." : "Settled."}
                </p>
              </div>
            </div>

            <details className="group mt-4 rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium hover:bg-muted/40">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /> Quarter by quarter
              </summary>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Quarter</th>
                      <th className="px-3 py-2 text-right font-medium">VAT on sales<span className="block text-xs font-normal">ours / declared</span></th>
                      <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">VAT on purchases<span className="block text-xs font-normal">ours / deducted</span></th>
                      <th className="px-3 py-2 text-right font-medium">Return</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">Paid / refunded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {quarters.map((q) => (
                      <tr key={q.key} className="align-top">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          <Link href={`/${q.key.replace("-", "/")}`} className="hover:underline">{q.label}</Link>
                          {q.missing && <div className="text-xs font-normal text-amber-700 dark:text-amber-400">no return on file</div>}
                          {!q.period && !subjectToVat(Number(q.key.slice(0, 4)), Number(q.key.slice(-1))) && <div className="text-xs font-normal text-muted-foreground">not registered for VAT yet</div>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {eur.format(q.est.collected)}
                          <span className="block text-xs text-muted-foreground">{q.period ? eur.format(declaredSalesVat(q.period)) : "—"}</span>
                        </td>
                        <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                          {eur.format(q.est.paid)}
                          <span className="block text-xs text-muted-foreground">{q.period ? eur.format(declaredInputVat(q.period)) : "—"}</span>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${q.net < 0 ? "text-green-700 dark:text-green-400" : ""}`}>
                          {q.period ? signed(q.net) : "—"}
                          {q.period && q.net !== 0 && <span className="block text-xs text-muted-foreground">{q.net < 0 ? "owed to us" : "owed to the State"}</span>}
                        </td>
                        <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                          {!q.period || q.net === 0
                            ? "—"
                            : q.settled.length === 0
                              ? q.net < 0
                                ? "Not refunded: carried forward"
                                : "No payment found"
                              : q.settled.map((p) => `${p.amount < 0 ? "Refunded" : "Paid"} ${eur.format(Math.abs(p.amount))} on ${shortDate(p.date)}`).join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          <div className="max-w-3xl space-y-3 text-sm text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">How to read this</h2>
            <p>
              &quot;Ours&quot; applies each category&apos;s rate to the money that actually moved, so it is an estimate. A return counts an invoice when it is issued, so an amount can fall in the quarter before or after the one that declared it: compare totals rather than single quarters.
            </p>
            <p>
              Our Wise card balance ended 2024 with €4,191.77. Where it went in 2025 is not traced yet: it was not part of Wise&apos;s final refund in April 2025.
            </p>
            <p>The returns also declare sales without Belgian VAT: services to customers in other EU countries (grid 44) and operations outside its scope (grid 47).</p>
            <p>
              Every amount comes from the{" "}
              <Link href="/integrity" className="underline underline-offset-2">public dataset</Link>, the returns from Intervat; see also{" "}
              <Link href="/taxes" className="underline underline-offset-2">all our taxes</Link>.
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
