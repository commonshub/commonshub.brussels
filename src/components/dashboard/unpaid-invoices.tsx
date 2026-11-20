import { Receipt } from "lucide-react"

import { UnpaidInvoiceActions } from "@/components/dashboard/unpaid-invoice-actions"
import { type BotIdentity, callTokenBot } from "@/lib/token-bot"

export type Unpaid = { id: number; number: string; date: string | null; dueDate: string | null; total: number; due: number; communication: string; label: string; subscription: { name: string; period: "month" | "year" } | null }

const eur = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(n)
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/Brussels" })

/**
 * Their unpaid invoices (from Odoo, through the bot), near the top of the dashboard: pay by card,
 * or by transfer on /pay (amount and communication filled in). An invoice of a monthly coworking
 * subscription can also become a year at once (two months free). Nothing when all is paid.
 */
export async function UnpaidInvoices({ who, readOnly }: { who: BotIdentity; readOnly?: boolean }) {
  const a = await callTokenBot("unpaid", who).catch(() => null)
  const invoices = a?.body.ok ? ((a.body as { invoices?: Unpaid[] }).invoices ?? []) : []
  if (!invoices.length) return null
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Brussels" })
  return (
    <section className="mt-6 rounded-2xl border-2 border-primary bg-card p-5" aria-labelledby="unpaid-invoices">
      <h2 id="unpaid-invoices" className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Receipt className="h-5 w-5 text-primary" /> {invoices.length === 1 ? "An invoice to pay" : `${invoices.length} invoices to pay`}
      </h2>
      <ul className="mt-3 divide-y divide-border">
        {invoices.map((i) => (
          <li key={i.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block break-words font-medium text-foreground">{i.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.number}
                  {i.dueDate ? ` · ${i.dueDate < today ? "was due" : "due"} on ${day(i.dueDate)}` : ""}
                  {i.due < i.total ? ` · ${eur(i.total - i.due)} already paid` : ""}
                </span>
              </span>
              <span className={`shrink-0 whitespace-nowrap font-bold ${i.dueDate && i.dueDate < today ? "text-destructive" : "text-foreground"}`}>{eur(i.due)}</span>
            </div>
            <UnpaidInvoiceActions invoice={{ id: i.id, due: i.due, communication: i.communication }} switchYearly={i.subscription?.period === "month" ? i.subscription.name : null} readOnly={readOnly} />
          </li>
        ))}
      </ul>
    </section>
  )
}
