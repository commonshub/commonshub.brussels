import Link from "next/link"
import { notFound } from "next/navigation"
import { ReceiptText } from "lucide-react"

import { loadTransactions } from "@/lib/vat-position-data"
import { EXPENSE_RULES, INCOME_RULES, txKey } from "@/lib/vat-position"
import { txPagePath } from "@/lib/tx-slug"
import type { Transaction } from "@/types/transactions"

// Reads the dataset at request time.
export const dynamic = "force-dynamic"

/** Events with their own money: everything tagged with the event's collective, that year. */
const EVENTS: Record<string, { year: number; collective: string; title: string; intro: string; video?: string; caveat?: string }> = {
  regenvillage: {
    year: 2024,
    collective: "regenvillage",
    title: "Regen Village 2024",
    intro:
      "Regen Village was a multi-day gathering for regenerative builders, held in Brussels during EthCC in July 2024 and organised with Regens Unite and DAO Brussels. Its sponsors also helped set up the Commons Hub. Here is all the money that went in and out for it.",
    video: "FSCi_173Alw",
    caveat:
      "The expenses only include payments whose message mentions Regen Village, or paid from the Regens Unite balance in June–August 2024. Costs paid from other accounts without such a message (the venue, infrastructure, people's time) are not tagged, so the net overstates what was left.",
  },
}

interface PageProps {
  params: Promise<{ year: string; event: string }>
}

const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" })
const shortDate = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" })
const isoDate = (ts: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date(ts * 1000))
const round = (n: number) => Math.round(n * 100) / 100

const isInternal = (tx: Transaction) => tx.type === "INTERNAL" || (tx.metadata?.category ?? "").replace(/-/g, "_") === "internal_transfer"
const categoryLabel = (tx: Transaction) => {
  const c = (tx.metadata?.category ?? "").replace(/-/g, "_")
  if (isInternal(tx)) return "Internal transfer"
  const rule = (tx.amount > 0 ? INCOME_RULES : EXPENSE_RULES)[c]
  if (c === "sponsoring") return "Sponsorship"
  if (c === "subsidy") return "Subsidy"
  return rule?.label ?? (c ? c.replace(/_/g, " ") : "Not categorised")
}
const noteOf = (tx: Transaction) => String((tx.metadata as Record<string, unknown>)?.note ?? "").trim()
const descriptionOf = (tx: Transaction) => noteOf(tx) || String(tx.metadata?.description ?? "").trim()

export async function generateMetadata({ params }: PageProps) {
  const { year, event } = await params
  const e = EVENTS[event]
  if (!e || String(e.year) !== year) return {}
  return { title: `${e.title}: the money | Commons Hub Brussels`, description: e.intro }
}

/** One event's money: a summary, the sponsors with their invoice and VAT treatment, and every transaction. */
export default async function EventMoneyPage({ params }: PageProps) {
  const { year, event } = await params
  const e = EVENTS[event]
  if (!e || String(e.year) !== year) notFound()

  const seen = new Set<string>()
  // Invoices for an event are often paid months later: the next year counts too.
  const rows = loadTransactions([e.year, e.year + 1])
    .filter((tx) => tx.metadata?.collective === e.collective && ["EUR", "EURe", "EURb"].includes(tx.currency))
    .filter((tx) => (seen.has(txKey(tx)) ? false : (seen.add(txKey(tx)), true)))
    .sort((a, b) => a.timestamp - b.timestamp)
  if (rows.length === 0) notFound()

  const counted = rows.filter((tx) => !isInternal(tx))
  const income = counted.filter((tx) => tx.amount > 0)
  const expenses = counted.filter((tx) => tx.amount < 0)
  const sum = (txs: Transaction[]) => round(txs.reduce((s, tx) => s + tx.amount, 0))
  const byCategory = (txs: Transaction[]) =>
    [...txs.reduce((m, tx) => m.set(categoryLabel(tx), [...(m.get(categoryLabel(tx)) ?? []), tx]), new Map<string, Transaction[]>())]
      .map(([label, txs]) => ({ label, total: sum(txs), count: txs.length }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  const internal = rows.filter(isInternal)
  const sponsors = income.filter((tx) => (tx.metadata?.category ?? "") === "sponsoring")
  const net = round(sum(income) + sum(expenses))

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-12 bg-primary/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href={`/${year}/events`} className="text-sm font-semibold uppercase tracking-wide text-primary hover:underline">
            Events {year}
          </Link>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold text-foreground">{e.title}</h1>
          <p className="mt-6 max-w-3xl text-lg text-muted-foreground">{e.intro}</p>
          {e.video && (
            <div className="mt-8 aspect-video w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${e.video}`}
                title={e.title}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Summary</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Came in", value: sum(income), groups: byCategory(income) },
                { label: "Went out", value: sum(expenses), groups: byCategory(expenses) },
              ].map((b) => (
                <div key={b.label} className="rounded-lg border border-border bg-card p-5">
                  <div className="text-sm text-muted-foreground">{b.label}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{eur.format(b.value)}</div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {b.groups.map((g) => (
                      <li key={g.label} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">
                          {g.label} <span className="text-xs">({g.count})</span>
                        </span>
                        <span className="tabular-nums">{eur.format(g.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="text-sm text-muted-foreground">Net</div>
                <div className={`mt-1 text-2xl font-bold tabular-nums ${net >= 0 ? "text-green-700 dark:text-green-400" : ""}`}>{eur.format(net)}</div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {counted.length} payments. Moves between our own accounts ({internal.length}, {eur.format(round(internal.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)))} each way) are listed below but not counted.
                </p>
              </div>
            </div>
            {e.caveat && <p className="mt-4 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">{e.caveat}</p>}
          </div>

          {sponsors.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground">Sponsors</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Each sponsorship with its invoice, the sponsor's country and the VAT treatment that follows from it.</p>
              <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                {sponsors.map((tx) => (
                  <li key={txKey(tx)} className="flex gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link href={txPagePath(tx.id, isoDate(tx.timestamp))} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <ReceiptText className="h-3.5 w-3.5" aria-hidden />
                        <span className="underline decoration-dotted underline-offset-2">{shortDate(tx.timestamp)}</span>
                      </Link>
                      <div className="mt-0.5 break-words text-foreground">{noteOf(tx) || (Math.abs(tx.amount) < 10 ? "Test payment before the sponsorship" : descriptionOf(tx) || "—")}</div>
                    </div>
                    <div className="tabular-nums">{eur.format(tx.amount)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-foreground">Every transaction</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">What</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Category</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((tx) => (
                    <tr key={txKey(tx)} className={`align-top ${isInternal(tx) ? "text-muted-foreground" : ""}`}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={txPagePath(tx.id, isoDate(tx.timestamp))} className="underline decoration-dotted underline-offset-2 hover:text-primary">
                          {shortDate(tx.timestamp)}
                        </Link>
                      </td>
                      <td className="max-w-xs px-3 py-2 break-words">
                        {descriptionOf(tx) || "—"}
                        <div className="text-xs text-muted-foreground sm:hidden">{categoryLabel(tx)}</div>
                      </td>
                      <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{categoryLabel(tx)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${tx.amount > 0 && !isInternal(tx) ? "text-green-700 dark:text-green-400" : ""}`}>{eur.format(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
