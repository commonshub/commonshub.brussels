"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { useAnnotation, useNostr } from "@/components/nostr-provider"
import settings from "@/settings/settings.json"

const CATEGORIES = settings.finance.categories.debit
const COLLECTIVES = Object.entries(settings.finance.collectives as Record<string, { name: string }>).map(([value, c]) => ({ value, label: c.name }))

/**
 * An expense's category and collective, tagged on Nostr like a transaction:
 * a kind 1111 annotation whose `i` tag is the expense's identifier, the
 * latest snapshot wins. Members can change them; everyone sees them.
 */
export function ExpenseTags({ uri, category, canEdit }: { uri: string; category?: string | null; canEdit: boolean }) {
  const annotation = useAnnotation(uri)
  const { publish, sync } = useNostr()
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const current = {
    category: annotation?.tagMap.category ?? category ?? "",
    collective: annotation?.tagMap.collective ?? "commonshub",
  }

  const save = async (key: "category" | "collective", value: string) => {
    setSaving(key)
    setSaved(false)
    try {
      await publish(uri, { tags: { [key]: value } })
      sync()
      setSaved(true)
    } finally {
      setSaving(null)
    }
  }

  const collectiveLabel = COLLECTIVES.find((c) => c.value === current.collective)?.label ?? current.collective
  if (!canEdit) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {current.category && <span className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground">{current.category}</span>}
        <span className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground">{collectiveLabel}</span>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2 text-muted-foreground">
        Category
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-foreground"
          value={current.category}
          disabled={!!saving}
          onChange={(e) => save("category", e.target.value)}
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-muted-foreground">
        Collective
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-foreground"
          value={current.collective}
          disabled={!!saving}
          onChange={(e) => save("collective", e.target.value)}
        >
          {COLLECTIVES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {saving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : saved ? <Check className="h-4 w-4 text-green-600" /> : null}
    </div>
  )
}

/** The category shown in a list: the members' tag on Nostr, else the books'. */
export function ExpenseCategoryBadge({ uri, category }: { uri: string; category?: string | null }) {
  const annotation = useAnnotation(uri)
  const value = annotation?.tagMap.category ?? category
  if (!value) return null
  return <span className="shrink-0 whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{value}</span>
}
