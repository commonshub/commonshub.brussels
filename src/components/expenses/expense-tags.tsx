"use client"

import { useState } from "react"
import { Check, Loader2, Pencil } from "lucide-react"

import { useAnnotation, useNostr } from "@/components/nostr-provider"
import settings from "@/settings/settings.json"

const CATEGORIES = settings.finance.categories.debit

/**
 * An expense's category, as a tag chip. Tagged on Nostr like a transaction:
 * a kind 1111 annotation whose `i` tag is the expense's identifier, the
 * latest snapshot wins. Everyone sees the chip; a member can add one when
 * there is none, or click it to change it. (No collective: everything on
 * this site is the Commons Hub's.)
 */
export function ExpenseTags({ uri, category, canEdit }: { uri: string; category?: string | null; canEdit: boolean }) {
  const annotation = useAnnotation(uri)
  const { publish, sync } = useNostr()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const current = annotation?.tagMap.category ?? category ?? ""

  const save = async (value: string) => {
    setEditing(false)
    if (!value || value === current) return
    setSaving(true)
    setSaved(false)
    try {
      await publish(uri, { tags: { category: value } })
      sync()
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const chip = "inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs text-foreground"

  if (canEdit && editing) {
    return (
      <select
        autoFocus
        className="h-7 rounded-full border border-border bg-background px-2.5 text-xs text-foreground"
        defaultValue={current}
        onChange={(e) => save(e.target.value)}
        onBlur={() => setEditing(false)}
        aria-label="Category"
      >
        <option value="" disabled>
          Pick a category…
        </option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    )
  }

  if (!current) {
    return canEdit ? (
      <button type="button" className={`${chip} border-dashed text-muted-foreground hover:text-foreground`} onClick={() => setEditing(true)}>
        + Add a category
      </button>
    ) : null
  }

  return (
    <span className="inline-flex items-center gap-2">
      {canEdit ? (
        <button type="button" className={`${chip} hover:border-primary`} onClick={() => setEditing(true)} title="Change the category">
          {current}
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      ) : (
        <span className={chip}>{current}</span>
      )}
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : saved ? <Check className="h-3.5 w-3.5 text-green-600" /> : null}
    </span>
  )
}

/** The category shown in a list: the members' tag on Nostr, else the books'. */
export function ExpenseCategoryBadge({ uri, category }: { uri: string; category?: string | null }) {
  const annotation = useAnnotation(uri)
  const value = annotation?.tagMap.category ?? category
  if (!value) return null
  return <span className="shrink-0 whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{value}</span>
}
