import Link from "next/link"

import type { ContributableExpense } from "@/lib/contribute-expenses"
import { formatEur } from "@/lib/contribute"

/**
 * Where the money goes each month, as one bar split into segments, like a
 * disk-usage view: each fixed cost takes the width of its share of the
 * total, and the legend below names every segment with its amount and
 * share, so nothing relies on colour alone.
 *
 * Colours follow the cost, never its rank. They are the first slots of a
 * categorical palette validated for colour-blind separation between
 * neighbours, in light and dark mode, and in size order the costs fall in
 * exactly that validated sequence. A cost not listed here takes the next
 * free slot.
 */
const SLOT_OF: Record<string, number> = {
  rent: 1,
  "property-tax": 2,
  "office-tax": 3,
  furniture: 4,
  electricity: 5,
  internet: 6,
}
const SLOTS = 8

function slotsFor(costs: ContributableExpense[]): Map<string, number> {
  const out = new Map<string, number>()
  const used = new Set<number>()
  for (const c of costs) {
    const slot = SLOT_OF[c.slug]
    if (slot) {
      out.set(c.slug, slot)
      used.add(slot)
    }
  }
  for (const c of costs) {
    if (out.has(c.slug)) continue
    const free = Array.from({ length: SLOTS }, (_, i) => i + 1).find((s) => !used.has(s))
    out.set(c.slug, free ?? 0)
    if (free) used.add(free)
  }
  return out
}

const pct = (share: number) => (share < 1 ? share.toFixed(1) : String(Math.round(share)))

export function FixedCostsChart({ costs }: { costs: ContributableExpense[] }) {
  const total = costs.reduce((sum, c) => sum + c.amountEur, 0)
  const slots = slotsFor(costs)
  const color = (slug: string) => {
    const slot = slots.get(slug) ?? 0
    return slot ? `var(--cost-${slot})` : "var(--muted-foreground)"
  }

  return (
    <div className="fixed-costs rounded-lg border border-border bg-card p-5 sm:p-6">
      <style>{`
        .fixed-costs {
          --cost-1: #2a78d6; --cost-2: #eb6834; --cost-3: #1baf7a; --cost-4: #eda100;
          --cost-5: #e87ba4; --cost-6: #008300; --cost-7: #4a3aa7; --cost-8: #e34948;
        }
        .dark .fixed-costs {
          --cost-1: #3987e5; --cost-2: #d95926; --cost-3: #199e70; --cost-4: #c98500;
          --cost-5: #d55181; --cost-6: #008300; --cost-7: #9085e9; --cost-8: #e66767;
        }
      `}</style>

      <div>
        <div className="text-3xl font-bold tabular-nums text-foreground">{formatEur(Math.round(total * 100) / 100)}</div>
        <div className="text-sm text-muted-foreground">in fixed costs, every month</div>
      </div>

      {/* The bar: one segment per cost, 2px of card between them. */}
      <div className="mt-4 flex h-6 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label={`Fixed costs, ${formatEur(Math.round(total * 100) / 100)} a month: ${costs.map((c) => `${c.label} ${pct((c.amountEur / total) * 100)}%`).join(", ")}`}>
        {costs.map((cost) => {
          const share = total > 0 ? (cost.amountEur / total) * 100 : 0
          return (
            <Link
              key={cost.slug}
              href={`/expenses/${cost.slug}`}
              title={`${cost.label}: ${formatEur(cost.amountEur)} a month, ${pct(share)}%`}
              className="block h-full min-w-[3px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ flexGrow: cost.amountEur, flexBasis: 0, backgroundColor: color(cost.slug) }}
              aria-hidden
              tabIndex={-1}
            />
          )
        })}
      </div>

      {/* The legend: every segment by name, amount and share. */}
      <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {costs.map((cost) => {
          const share = total > 0 ? (cost.amountEur / total) * 100 : 0
          return (
            <li key={cost.slug}>
              <Link href={`/expenses/${cost.slug}`} className="group flex items-center gap-2.5 text-sm">
                <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: color(cost.slug) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-foreground group-hover:text-primary">{cost.label}</span>
                <span className="shrink-0 tabular-nums text-foreground">{formatEur(cost.amountEur)}</span>
                <span className="w-11 shrink-0 text-right tabular-nums text-muted-foreground">{pct(share)}%</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
