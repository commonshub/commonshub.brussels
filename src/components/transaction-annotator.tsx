"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Plus, X } from "lucide-react"

import { useAnnotation, useNostr } from "@/components/nostr-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface Baseline {
  description: string
  category: string
  collective: string
}

/**
 * What we know about one transaction, and a way for members to add to it:
 * a description, a category, a collective, free labels, and a name for the
 * counterparty. Saved on Nostr like txinfo.xyz does: a kind 1111 snapshot
 * whose `i` tag is the transaction's id (labels as `t` tags), and one on
 * the counterparty's id for its name. Signed with this browser's key.
 */
export function TransactionAnnotator({
  uri,
  baseline,
  counterparty,
  canEdit,
  categories,
  collectives,
}: {
  uri: string
  baseline: Baseline
  counterparty: { uri: string; name: string } | null
  canEdit: boolean
  categories: string[]
  collectives: Array<{ value: string; label: string }>
}) {
  const ann = useAnnotation(uri)
  const cpAnn = useAnnotation(counterparty?.uri)
  const { publish, sync, ready } = useNostr()

  const current = {
    description: ann?.content || baseline.description,
    category: ann?.tagMap.category ?? baseline.category,
    collective: ann?.tagMap.collective ?? baseline.collective,
    labels: ann?.labels ?? [],
    name: cpAnn?.tagMap.name ?? counterparty?.name ?? "",
  }

  const [draft, setDraft] = useState(current)
  const [label, setLabel] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [dirty, setDirty] = useState(false)

  // Follow what arrives from the relays until the member starts typing.
  const key = JSON.stringify(current)
  useEffect(() => {
    if (!dirty) setDraft(JSON.parse(key))
  }, [key, dirty])

  const edit = (patch: Partial<typeof draft>) => {
    setDirty(true)
    setState("idle")
    setDraft((d) => ({ ...d, ...patch }))
  }
  const addLabel = () => {
    const l = label.trim().replace(/^#/, "")
    if (l && !draft.labels.includes(l)) edit({ labels: [...draft.labels, l] })
    setLabel("")
  }

  const save = async () => {
    setState("saving")
    try {
      await publish(uri, {
        content: draft.description.trim(),
        tags: { category: draft.category.trim() || null, collective: draft.collective || null },
        labels: draft.labels,
      })
      if (counterparty && draft.name.trim() !== current.name) await publish(counterparty.uri, { tags: { name: draft.name.trim() || null } })
      sync()
      setDirty(false)
      setState("saved")
    } catch {
      setState("error")
    }
  }

  if (!canEdit) {
    return (
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Description</dt>
        <dd className="whitespace-pre-line break-words">{current.description || "—"}</dd>
        <dt className="text-muted-foreground">Category</dt>
        <dd>{current.category || "—"}</dd>
        <dt className="text-muted-foreground">Collective</dt>
        <dd>{collectives.find((c) => c.value === current.collective)?.label ?? (current.collective || "—")}</dd>
        {current.labels.length > 0 && (
          <>
            <dt className="text-muted-foreground">Labels</dt>
            <dd className="flex flex-wrap gap-1.5">
              {current.labels.map((l) => (
                <span key={l} className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {l}
                </span>
              ))}
            </dd>
          </>
        )}
        {counterparty && (
          <>
            <dt className="text-muted-foreground">Counterparty</dt>
            <dd>{current.name || "—"}</dd>
          </>
        )}
      </dl>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Description</span>
        <Textarea value={draft.description} onChange={(e) => edit({ description: e.target.value })} rows={3} maxLength={2000} placeholder="What is this payment? An invoice number, who it is from, why…" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Category</span>
          <Input list="tx-categories" value={draft.category} onChange={(e) => edit({ category: e.target.value })} placeholder="donation, rental, sponsoring…" />
          <datalist id="tx-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Collective</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={draft.collective}
            onChange={(e) => edit({ collective: e.target.value })}
          >
            <option value="">—</option>
            {collectives.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {counterparty && (
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Counterparty name</span>
          <Input value={draft.name} onChange={(e) => edit({ name: e.target.value })} placeholder="Who paid us, or who we paid" />
          <span className="text-xs text-muted-foreground">Names this counterparty on every transaction with it.</span>
        </label>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="font-medium">Labels</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {draft.labels.map((l) => (
            <span key={l} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs">
              {l}
              <button type="button" aria-label={`Remove ${l}`} onClick={() => edit({ labels: draft.labels.filter((x) => x !== l) })} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  addLabel()
                }
              }}
              placeholder="Add a label"
              className="h-7 w-36 text-xs"
            />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addLabel} disabled={!label.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={!dirty || state === "saving" || !ready}>
          {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
        {state === "saved" && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
            <Check className="h-3.5 w-3.5" /> Saved on Nostr. The public data catches up at chb&apos;s next run.
          </span>
        )}
        {state === "error" && <span className="text-xs text-destructive">Could not save. Try again.</span>}
        {state === "idle" && <span className="text-xs text-muted-foreground">Signed with your own key and recorded on the Commons Hub relay.</span>}
      </div>
    </div>
  )
}
