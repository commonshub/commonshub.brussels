"use client"

import { useState } from "react"

type Item = { at: number; amount: number; label: string; description: string; date: string }

/** The transactions, ten at first, then ten more per click. */
export function TransactionList({ items, step = 10 }: { items: Item[]; step?: number }) {
  const [shown, setShown] = useState(step)
  return (
    <div className="rounded-2xl border border-border bg-card px-5">
      <ul className="divide-y divide-border">
        {items.slice(0, shown).map((t, i) => (
          <li key={`${t.at}-${i}`} className="flex items-start justify-between gap-4 py-3">
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">{t.date}</span>
              <span className="block break-words text-sm text-foreground">{t.description}</span>
            </span>
            <span className={`shrink-0 whitespace-nowrap text-sm font-bold ${t.amount > 0 ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>{t.label}</span>
          </li>
        ))}
      </ul>
      {shown < items.length && (
        <div className="border-t border-border py-3 text-center">
          <button type="button" onClick={() => setShown((n) => n + step)} className="text-sm font-semibold text-primary hover:underline">
            Show more
          </button>
        </div>
      )}
    </div>
  )
}
