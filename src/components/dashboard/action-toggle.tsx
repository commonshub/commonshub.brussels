"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

/**
 * A compact dashboard tile (Cowork, Book a room): tap it to reveal who it's
 * for (me or a guest), tap it again to fold it back.
 */
export function ActionToggle({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-2xl border bg-card transition ${open ? "border-primary" : "border-border"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:bg-muted/60">
        {icon}
        <span className="min-w-0 flex-1 text-lg font-bold text-foreground">{title}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="animate-in fade-in slide-in-from-top-1 px-4 pb-4">
          <p className="text-sm text-muted-foreground">{text}</p>
          <div className="mt-3 flex flex-wrap gap-2">{children}</div>
        </div>
      )}
    </div>
  )
}
