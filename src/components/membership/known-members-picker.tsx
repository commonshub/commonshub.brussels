"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

import { Input } from "@/components/ui/input"

export interface KnownMember {
  /** Their Discord id; none for a name typed by hand. */
  id?: string
  name: string
  avatar?: string | null
}

/**
 * "Who do you know at the hub?": type a name, pick members of the
 * community's Discord (several), or keep a name that isn't on Discord.
 */
export function KnownMembersPicker({ value, onChange }: { value: KnownMember[]; onChange: (v: KnownMember[]) => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<{ id: string; displayName: string; avatar: string | null }>>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return setResults([])
    setSearching(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/tablet/members?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { members?: Array<{ id: string; displayName: string; avatar: string | null }> }) => setResults(d.members ?? []))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 200)
    return () => (clearTimeout(timer), controller.abort())
  }, [query])

  const add = (m: KnownMember) => {
    if (!value.some((v) => (m.id ? v.id === m.id : !v.id && v.name.toLowerCase() === m.name.toLowerCase()))) onChange([...value, m])
    setQuery("")
    setResults([])
  }
  const shown = results.filter((r) => !value.some((v) => v.id === r.id))

  return (
    <div className="mt-1.5">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((m) => (
            <span key={m.id ?? m.name} className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/5 py-1 pl-1 pr-2 text-sm">
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{m.name.slice(0, 1).toUpperCase()}</span>
              )}
              <span className="font-medium">{m.name}</span>
              <button type="button" aria-label={`Remove ${m.name}`} onClick={() => onChange(value.filter((v) => v !== m))} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id="who-you-know"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (shown[0]) add({ id: shown[0].id, name: shown[0].displayName, avatar: shown[0].avatar })
            else if (query.trim()) add({ name: query.trim() })
          }
        }}
        placeholder="Type a name to find members"
        autoComplete="off"
      />
      {query.trim().length >= 2 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {shown.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => add({ id: r.id, name: r.displayName, avatar: r.avatar })}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm hover:border-primary"
            >
              {r.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{r.displayName.slice(0, 1).toUpperCase()}</span>
              )}
              <span className="font-medium">{r.displayName}</span>
            </button>
          ))}
          {!searching && (
            <button type="button" onClick={() => add({ name: query.trim() })} className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary">
              Add “{query.trim()}”{shown.length === 0 ? " (not found on our Discord)" : ""}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
