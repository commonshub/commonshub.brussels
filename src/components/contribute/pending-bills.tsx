import Link from "next/link"
import { ArrowRight, Receipt } from "lucide-react"

import type { ContributableExpense, PendingSummary } from "@/lib/contribute-expenses"
import { formatEur } from "@/lib/contribute"

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const moment = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-BE", { style: "currency", currency }).format(amount)

function BillRow({ bill }: { bill: ContributableExpense }) {
  return (
    <li>
      <Link href={`/contribute/${bill.slug}`} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">{bill.vendor}</div>
          <div className="truncate text-sm text-muted-foreground">{bill.label}</div>
        </div>
        <div className="hidden shrink-0 text-right text-sm sm:block">
          {/* Neutral on purpose: until the books are reconciled, many "overdue"
              bills were in fact paid by direct debit (see the note below). */}
          {bill.dueDate && <span className="text-muted-foreground">Due {day(bill.dueDate)}</span>}
        </div>
        <div className="w-24 shrink-0 text-right">
          <div className="font-semibold tabular-nums text-foreground">{formatEur(bill.amountEur)}</div>
        </div>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary md:inline-flex">
          Chip in
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  )
}

/**
 * What the Hub still owes its suppliers (chb's pending-bills.json), with a
 * way to cover any of it. The list is only as current as the bookkeeping:
 * a bill paid by direct debit stays here until the bank line is matched.
 */
export function PendingBills({ bills, summary, shown = 10 }: { bills: ContributableExpense[]; summary: PendingSummary; shown?: number }) {
  const first = bills.slice(0, shown)
  const rest = bills.slice(shown)

  return (
    <div>
      <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <Receipt className="h-6 w-6 text-primary" />
        Bills still to pay
      </h2>
      <p className="mt-2 text-muted-foreground">
        What we still owe our suppliers, straight from our books. Cover a bill in full, or chip in a part of it: the money
        comes to the Hub, earmarked for that bill, and the stewards pay the supplier.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border px-4 py-4">
          <div>
            <div className="text-3xl font-bold tabular-nums text-foreground">{formatEur(summary.amountDue)}</div>
            <div className="text-sm text-muted-foreground">
              {summary.count} {summary.count === 1 ? "bill" : "bills"} still to pay
              {summary.otherCurrencies.map((c) => `, plus ${money(c.amountDue, c.currency)} in ${c.currency}`).join("")}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Updated {moment(summary.generatedAt)}</div>
        </div>

        {bills.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing outstanding right now.</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {first.map((bill) => (
                <BillRow key={bill.slug} bill={bill} />
              ))}
            </ul>
            {rest.length > 0 && (
              <details className="group border-t border-border">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-primary group-open:hidden">
                  Show the other {rest.length} {rest.length === 1 ? "bill" : "bills"}
                </summary>
                <ul className="divide-y divide-border">
                  {rest.map((bill) => (
                    <BillRow key={bill.slug} bill={bill} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A bill paid by direct debit can stay on this list until we have matched the payment in our books.
      </p>
    </div>
  )
}
