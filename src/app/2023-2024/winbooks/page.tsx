import Link from "next/link"
import { ArrowLeft, ChevronDown } from "lucide-react"

import { explorerTxUrl } from "@/lib/taxes"
import { vatPosition } from "@/lib/vat-position"
import { loadTransactions } from "@/lib/vat-position-data"
import { THEMES, WINBOOKS, compareWithWinbooks, type LineResult } from "@/lib/winbooks-2023-2024"

// Reads the dataset volume, so never prerender it.
export const dynamic = "force-dynamic"

export const metadata = {
  title: "WinBooks and the money, 2023–2024 | Commons Hub Brussels",
  description: "Our books (WinBooks) for July 2023 to December 2024 next to the money that actually moved, line by line, with the reason for every difference.",
}

const YEARS = [2023, 2024]
const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" })
const signed = (n: number) => (n < 0 ? `−${eur.format(-n)}` : n > 0 ? `+${eur.format(n)}` : eur.format(0))

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums sm:text-3xl ${tone === "warn" ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>{value}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

/** A line of the comparison: WinBooks, the page, the difference, opening onto the reasons. */
function Line({ r }: { r: LineResult }) {
  const open = Math.abs(r.unexplained) >= 1
  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[1rem_1fr_auto] items-start gap-x-3 px-4 py-3 hover:bg-muted/40 sm:grid-cols-[1rem_1fr_8rem_8rem_8rem]">
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        <span className="min-w-0 font-medium text-foreground">
          {r.line.label}
          {open && <span className="block text-xs font-normal text-amber-700 dark:text-amber-400">{signed(r.unexplained)} not explained yet</span>}
        </span>
        <span className="hidden text-right tabular-nums sm:block">{eur.format(r.winbooks)}</span>
        <span className="hidden text-right tabular-nums sm:block">{eur.format(r.page)}</span>
        <span className="text-right tabular-nums font-medium">
          {signed(r.difference)}
          <span className="block text-xs font-normal text-muted-foreground sm:hidden">
            {eur.format(r.winbooks)} vs {eur.format(r.page)}
          </span>
        </span>
      </summary>
      <div className="space-y-3 bg-muted/20 px-4 py-3 pl-11 text-sm">
        <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="font-medium text-foreground">WinBooks</dt>
            <dd>{r.line.winbooks.accounts}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">On the 2023–2024 page{r.line.withoutVat ? ", without the VAT in it" : ""}</dt>
            <dd>
              {r.pageCategories.length === 0
                ? "nothing"
                : r.pageCategories.map((c) => `${c.label} ${eur.format(r.line.withoutVat ? c.amount - c.vat : c.amount)}`).join(", ")}
            </dd>
          </div>
        </dl>
        {(r.reasons.length > 0 || open) && (
          <ul className="divide-y divide-border rounded-md border border-border bg-background">
            {r.reasons.map((x) => (
              <li key={x.title} className="flex gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{x.title}</div>
                  <div className="text-xs text-muted-foreground">{x.detail}</div>
                </div>
                <div className="text-right tabular-nums">{signed(x.amount)}</div>
              </li>
            ))}
            {open && (
              <li className="flex gap-3 px-3 py-2 text-amber-800 dark:text-amber-300">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.line.rest ?? "Not explained yet"}</div>
                  <div className="text-xs">What the reasons above do not cover. It moves with the 2023–2024 page.</div>
                </div>
                <div className="text-right tabular-nums">{signed(r.unexplained)}</div>
              </li>
            )}
          </ul>
        )}
      </div>
    </details>
  )
}

function Lines({ lines, total }: { lines: LineResult[]; total: { winbooks: number; page: number; difference: number } }) {
  return (
    <div className="mt-6 rounded-lg border border-border">
      <div className="hidden grid-cols-[1rem_1fr_8rem_8rem_8rem] gap-x-3 border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span />
        <span />
        <span className="text-right">WinBooks</span>
        <span className="text-right">2023–2024 page</span>
        <span className="text-right">Difference</span>
      </div>
      <div className="divide-y divide-border">
        {lines.map((r) => (
          <Line key={r.line.key} r={r} />
        ))}
      </div>
      <div className="grid grid-cols-[1rem_1fr_auto] gap-x-3 border-t border-border bg-muted/30 px-4 py-3 font-semibold sm:grid-cols-[1rem_1fr_8rem_8rem_8rem]">
        <span />
        <span>Total</span>
        <span className="hidden text-right tabular-nums sm:block">{eur.format(total.winbooks)}</span>
        <span className="hidden text-right tabular-nums sm:block">{eur.format(total.page)}</span>
        <span className="text-right tabular-nums">{signed(total.difference)}</span>
      </div>
    </div>
  )
}

export default function Winbooks20232024Page() {
  const txs = loadTransactions([...YEARS, YEARS[YEARS.length - 1] + 1])
  const position = vatPosition(txs, YEARS, explorerTxUrl)
  const c = compareWithWinbooks(position)
  const income = c.lines.filter((l) => l.line.direction === "income" && (l.winbooks !== 0 || l.page !== 0))
  const expense = c.lines.filter((l) => l.line.direction === "expense")

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-12 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/2023-2024" className="inline-flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> VAT 2023–2024
          </Link>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-foreground">WinBooks and the money</h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
            Our books for the first financial year (July 2023 to December 2024), kept in WinBooks, next to what the{" "}
            <Link href="/2023-2024" className="underline underline-offset-2">2023–2024 page</Link> counts from the money that actually moved. Every difference is traced to a reason with an amount; what is not traced yet is shown as such.
          </p>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Summary</h2>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              WinBooks shows {eur.format(Math.abs(c.income.difference))} {c.income.difference >= 0 ? "more" : "less"} income than the money that came in. The two largest reasons pull in opposite directions: WinBooks books the campaign loans and token top-ups as debts, not income, and it counts some crypto grant money twice. It shows{" "}
              {eur.format(Math.abs(c.expense.difference))} {c.expense.difference >= 0 ? "more" : "less"} costs than what was paid, mostly because it books invoices for 2024 that were paid in 2025.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">Income</h3>
                <div className="mt-3 grid grid-cols-3 gap-4">
                  <Figure label="WinBooks" value={eur.format(c.income.winbooks)} note="without VAT" />
                  <Figure label="2023–2024 page" value={eur.format(c.income.page)} note="received, without VAT" />
                  <Figure label="Difference" value={signed(c.income.difference)} />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">Expenses</h3>
                <div className="mt-3 grid grid-cols-3 gap-4">
                  <Figure label="WinBooks" value={eur.format(c.expense.winbooks)} note="with the VAT booked" />
                  <Figure label="2023–2024 page" value={eur.format(c.expense.page)} note="paid, VAT included" />
                  <Figure label="Difference" value={signed(c.expense.difference)} />
                </div>
              </div>
            </div>

            <h3 className="mt-8 text-lg font-semibold text-foreground">The main reasons</h3>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {c.themes.map((t) => (
                <li key={t.theme} className="flex gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{THEMES[t.theme].title}</div>
                    <div className="text-sm text-muted-foreground">{THEMES[t.theme].why}</div>
                  </div>
                  <div className="text-right tabular-nums font-medium">{signed(t.amount)}</div>
                </li>
              ))}
              <li className={`flex gap-3 px-4 py-3 ${Math.abs(c.unexplained) >= 1 ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">Not explained yet</div>
                  <div className="text-sm">The rest, line by line below.</div>
                </div>
                <div className="text-right tabular-nums font-medium">{signed(c.unexplained)}</div>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Amounts are WinBooks minus the page: positive where WinBooks has more. Income and expenses together.</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">1. Income</h2>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              WinBooks books income without VAT, so the page&apos;s sales are shown here without the VAT it estimates in them. Open a line to see what it holds on each side and why they differ.
            </p>
            <Lines lines={income} total={c.income} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">2. Expenses</h2>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              WinBooks books costs by nature, not by our categories, so expenses are compared as one total: WinBooks costs with the VAT booked with them, against what the page counts as paid.
            </p>
            <Lines lines={expense} total={c.expense} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">3. VAT</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium" />
                    <th className="px-3 py-2 text-right font-medium">WinBooks and the returns</th>
                    <th className="px-3 py-2 text-right font-medium">2023–2024 page</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-3 py-2">VAT on sales</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(WINBOOKS.declaredSalesVat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(position.income.vat)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2">VAT on purchases</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(WINBOOKS.deductedVat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur.format(position.expense.vat)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 max-w-3xl space-y-2 text-sm text-muted-foreground">
              <p>WinBooks matches the filed returns exactly: its VAT accounts close the year at zero against them. The differences with the page are the ones the 2023–2024 page shows:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>VAT on sales: only invoices carry a VAT code in WinBooks. Ticket sales, Stripe membership, the Stripe service and coworking sales and the Citizen Wallet sponsor contributions carry none, so they are in no return.</li>
                <li>
                  VAT on purchases: the page takes the VAT out of every payment at the rate of its category, an upper bound (a freelancer under the small-business threshold charges none). WinBooks deducts what is on the invoices it received, and {eur.format(WINBOOKS.deductedIn2025)} of VAT on 2023–2024 invoices was deducted only in the 2025 returns.
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-3xl space-y-3 text-sm text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">How this was made</h2>
            <p>
              The WinBooks figures are the postings of book year 1 (1 July 2023 to 31 December 2024) in the WinBooks export of 3 March 2026. They are split by category as in the 2023–2024 income reconciliation. The year is closed, so they do not change.
            </p>
            <p>
              The page figures are computed here from the same{" "}
              <Link href="/integrity" className="underline underline-offset-2">public dataset</Link> and the same rules as the{" "}
              <Link href="/2023-2024" className="underline underline-offset-2">2023–2024 page</Link>, so they change with it. Each reason was traced posting by posting against the transactions; what the reasons do not cover is shown as not explained yet.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
