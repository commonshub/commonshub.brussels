import Link from "next/link"

import type { ContributableExpense } from "@/lib/contribute-expenses"
import { formatEur } from "@/lib/contribute"

/**
 * How the monthly fixed costs compare. One bar per cost, largest first, in
 * one colour: the job is magnitude, so length carries it and the amount and
 * share are written beside each bar. Bars are measured against the largest
 * cost so the small ones stay visible; the percentages say their share of
 * the total. Each row opens that cost's page.
 */
export function FixedCostsChart({ costs }: { costs: ContributableExpense[] }) {
  const total = costs.reduce((sum, c) => sum + c.amountEur, 0)
  const largest = Math.max(...costs.map((c) => c.amountEur), 1)

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <div className="text-3xl font-bold tabular-nums text-foreground">{formatEur(Math.round(total * 100) / 100)}</div>
          <div className="text-sm text-muted-foreground">in fixed costs, every month</div>
        </div>
        <div className="text-sm text-muted-foreground">Share of the total</div>
      </div>

      <ul className="mt-5 flex flex-col gap-3.5">
        {costs.map((cost) => {
          const share = total > 0 ? (cost.amountEur / total) * 100 : 0
          const width = Math.max(0.8, (cost.amountEur / largest) * 100)
          return (
            <li key={cost.slug}>
              <Link
                href={`/contribute/${cost.slug}`}
                title={`${cost.label}: ${formatEur(cost.amountEur)} a month, ${share.toFixed(1)}% of the fixed costs`}
                className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-foreground group-hover:text-primary">{cost.label}</span>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {formatEur(cost.amountEur)}
                    <span className="ml-2 inline-block w-12 text-right text-muted-foreground">{share < 1 ? share.toFixed(1) : Math.round(share)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full rounded-r bg-muted">
                  <div className="h-full rounded-r bg-primary transition-opacity group-hover:opacity-80" style={{ width: `${width}%` }} />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
