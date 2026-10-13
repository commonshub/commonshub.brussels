import Link from "next/link"
import { CalendarClock, Flame, Hourglass, Wallet } from "lucide-react"

import { formatEur } from "@/lib/contribute"
import type { FinanceOutlook } from "@/lib/finance-outlook"

const eur = (n: number) => formatEur(Math.round(n))
const monthName = (month: string, style: "short" | "long" = "short") =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: style, ...(style === "long" ? { year: "numeric" } : {}) })
const months = (n: number) => (n === 1 ? "1 month" : `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })} months`)

function Tile({ icon: Icon, label, value, children }: { icon: typeof Wallet; label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

/**
 * Income against spending, month by month: two bars per month (income first),
 * the same two colours as the legend, a dashed line at the monthly fixed
 * costs. The colours are the first two slots of the palette /contribute
 * uses, validated for colour-blind separation; the legend names them and
 * every month's numbers are in its tooltip and in the table for screen readers.
 */
function FlowChart({ outlook }: { outlook: FinanceOutlook }) {
  const max = Math.max(1, outlook.fixedMonthly, ...outlook.months.flatMap((m) => [m.income, m.spending]))
  const pct = (n: number) => `${(n / max) * 100}%`
  return (
    <div className="flow-chart">
      <style>{`.flow-chart { --flow-in: #2a78d6; --flow-out: #eb6834; } .dark .flow-chart { --flow-in: #3987e5; --flow-out: #d95926; }`}</style>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: "var(--flow-in)" }} /> Income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: "var(--flow-out)" }} /> Spending
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-muted-foreground" /> Fixed costs ({eur(outlook.fixedMonthly)})
        </span>
      </div>

      <div className="relative mt-4 h-48" aria-hidden="true">
        <div className="absolute inset-x-0 z-10 border-t-2 border-dashed border-muted-foreground/60" style={{ bottom: pct(outlook.fixedMonthly) }} />
        <div className="absolute inset-0 flex items-end gap-1 border-b border-border sm:gap-2">
          {outlook.months.map((m) => (
            <div key={m.month} className="group relative flex h-full flex-1 items-end justify-center gap-[2px] hover:bg-muted/40">
              <div className={`w-1/2 max-w-4 rounded-t-[4px] ${m.partial ? "opacity-50" : ""}`} style={{ height: pct(m.income), background: "var(--flow-in)" }} />
              <div className={`w-1/2 max-w-4 rounded-t-[4px] ${m.partial ? "opacity-50" : ""}`} style={{ height: pct(m.spending), background: "var(--flow-out)" }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md group-hover:block">
                <div className="font-medium">
                  {monthName(m.month, "long")}
                  {m.partial ? " (so far)" : ""}
                </div>
                <div>Income {eur(m.income)}</div>
                <div>Spending {eur(m.spending)}</div>
                <div>{m.income - m.spending >= 0 ? "+" : "−"}{eur(Math.abs(m.income - m.spending))}</div>
                {m.exceptional ? <div>Left out: {eur(m.exceptional)} exceptional loss</div> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-1 text-center text-[10px] text-muted-foreground sm:gap-2 sm:text-xs" aria-hidden="true">
        {outlook.months.map((m, i) => (
          <div key={m.month} className={`flex-1 ${i % 2 === outlook.months.length % 2 ? "max-sm:invisible" : ""}`}>
            {monthName(m.month)}
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Income and spending per month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Income</th>
            <th>Spending</th>
          </tr>
        </thead>
        <tbody>
          {outlook.months.map((m) => (
            <tr key={m.month}>
              <td>
                {monthName(m.month, "long")}
                {m.partial ? " (so far)" : ""}
              </td>
              <td>{eur(m.income)}</td>
              <td>{eur(m.spending)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** One plain sentence on where we stand. */
function verdict(o: FinanceOutlook): string {
  const afterBills = o.cash - (o.unpaidBills?.amount ?? 0)
  if (afterBills < 0) return `The unpaid bills add up to more than what is in the accounts: ${eur(-afterBills)} short, before next month's rent.`
  if (o.runwayMonths === null) return `Over the last ${months(o.window)}, income covered spending. After the unpaid bills, ${eur(afterBills)} is left: ${months(o.fixedCostsCovered)} of fixed costs.`
  return `At the pace of the last ${months(o.window)}, what is left after the unpaid bills lasts about ${months(o.runwayMonths)}.`
}

export function FinanceOutlookSection({ outlook }: { outlook: FinanceOutlook }) {
  const o = outlook
  const afterBills = o.cash - (o.unpaidBills?.amount ?? 0)
  const monthlyCosts = o.fixedCosts.filter((c) => !c.annual)
  const yearlyCosts = o.fixedCosts.filter((c) => c.annual)
  const exceptional = o.months.filter((m) => m.exceptional)

  return (
    <section className="space-y-6" aria-labelledby="where-we-stand">
      <div className="space-y-1">
        <h2 id="where-we-stand" className="text-2xl font-bold">
          Where we stand
        </h2>
        <p className="text-lg text-foreground">{verdict(o)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Wallet} label="In the accounts now" value={eur(o.cash)}>
          <p>Bank, Stripe and on-chain accounts together (see each one below).</p>
        </Tile>

        <Tile icon={CalendarClock} label="Still to pay" value={o.unpaidBills ? eur(o.unpaidBills.amount) : "–"}>
          {o.unpaidBills ? (
            <p>
              {o.unpaidBills.count} unpaid bills in our books
              {o.unpaidBills.overdue > 0 ? `, ${eur(o.unpaidBills.overdue)} of it past due` : ""}.{" "}
              <Link href="/contribute" className="underline underline-offset-2">
                Cover one
              </Link>
            </p>
          ) : (
            <p>The list of unpaid bills is not published yet.</p>
          )}
          <p>
            Then {eur(o.nextMonthFixed)} every month for {monthlyCosts.map((c) => c.label.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}.
          </p>
        </Tile>

        <Tile icon={Flame} label="Burn rate" value={o.netBurn > 0 ? `${eur(o.netBurn)}/mo` : "None"}>
          <p>
            Spending {eur(o.avgSpending)} against income {eur(o.avgIncome)} a month, on average over the last {months(o.window)}.
          </p>
          <p>
            Fixed costs alone: {eur(o.fixedMonthly)} a month
            {yearlyCosts.length > 0 ? `, the yearly ${yearlyCosts.map((c) => c.label.replace(/ \(.*\)$/, "").toLowerCase()).join(" and ")} counted as a twelfth` : ""}.
          </p>
        </Tile>

        <Tile
          icon={Hourglass}
          label="Runway"
          value={afterBills < 0 ? "Short" : o.runwayMonths === null ? "No end" : months(o.runwayMonths)}
        >
          <p>
            {afterBills < 0
              ? `The unpaid bills are ${eur(-afterBills)} more than the cash.`
              : `${eur(afterBills)} is left once the unpaid bills are paid.`}
          </p>
          <p>With no income at all, that covers {months(o.fixedCostsCovered)} of fixed costs.</p>
        </Tile>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h3 className="font-semibold text-foreground">Income and spending, month by month</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          What the Hub itself received and paid. Transfers between our own accounts are left out, and so is the money
          of the projects we host.{" "}
          {exceptional.length > 0
            ? `${exceptional.map((m) => `${eur(m.exceptional!)} lost in ${monthName(m.month, "long")}`).join(", ")} (the books call it exceptional: the hack of the old savings account) is left out too. `
            : ""}
          {monthName(o.months[o.months.length - 1].month, "long")} is still running.
        </p>
        <div className="mt-4">
          <FlowChart outlook={o} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The unpaid bills are only as current as the bookkeeping: a bill paid by direct debit or card stays on the list
        until its payment is matched in the books. The cash includes money we hold for the projects we host. The fixed
        costs and the bills are the ones listed on{" "}
        <Link href="/contribute" className="underline underline-offset-2">
          /contribute
        </Link>
        , where you can take one on.
      </p>
    </section>
  )
}
