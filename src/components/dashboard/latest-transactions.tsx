import { ArrowLeftRight } from "lucide-react"

import { TransactionList } from "@/components/dashboard/transaction-list"
import { transactions } from "@/lib/monthly-recap-email"
import { loadRecap, parsePeriod, type TokenLine } from "@/lib/monthly-recap"
import { type BotIdentity, callTokenBot } from "@/lib/token-bot"

type Euro = { at: number; amount: number; description: string }

/**
 * At the bottom of the dashboard: their latest transactions, tokens and euros in one list, as in
 * the monthly recap email. Euros from the bot (invoices paid in Odoo, membership payments on
 * Stripe), tokens from the members' data (this year and last). Newest first; ten, then more.
 */
export async function LatestTransactions({ who, discordId, now = new Date() }: { who: BotIdentity; discordId?: string | null; now?: Date }) {
  const year = now.getFullYear()
  const [euros, ...recaps] = await Promise.all([
    callTokenBot("history", who)
      .then((a) => (a.body.ok ? ((a.body as { euros?: Array<{ at: string; amount: number; description: string }> }).euros ?? []) : []))
      .then((list) => list.map((e): Euro => ({ at: Date.parse(e.at), amount: Number(e.amount), description: String(e.description ?? "") })).filter((e) => Number.isFinite(e.at) && Number.isFinite(e.amount) && e.amount !== 0))
      .catch(() => [] as Euro[]),
    ...(discordId ? [String(year), String(year - 1)].map((y) => loadRecap({ id: discordId }, parsePeriod(y)!, now).catch(() => null)) : []),
  ])
  const received: TokenLine[] = recaps.flatMap((r) => r?.received ?? [])
  const spent: TokenLine[] = recaps.flatMap((r) => r?.spent ?? [])
  const list = transactions({ received, spent, euros })
    .reverse()
    .slice(0, 100)
    .map((t) => ({ ...t, date: new Date(t.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" }) }))
  if (!list.length) return null
  return (
    <section className="mt-10" aria-labelledby="latest-transactions">
      <h2 id="latest-transactions" className="mb-3 flex items-center gap-2 text-xl font-bold text-foreground">
        <ArrowLeftRight className="h-5 w-5 text-primary" /> Latest transactions
      </h2>
      <TransactionList items={list} />
    </section>
  )
}
