"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import type { Frequency, NotificationSettings } from "@/lib/notification-settings"

const OPTIONS: Array<{ key: Frequency; label: string; text: string }> = [
  { key: "monthly", label: "Monthly", text: "At the start of each month, about the month before." },
  { key: "quarterly", label: "Quarterly", text: "In January, April, July and October, about the three months before." },
  { key: "yearly", label: "Yearly", text: "In January, about the whole year." },
]

export function NotificationForm({ token, initial }: { token?: string; initial: Pick<NotificationSettings, Frequency> }) {
  const [settings, setSettings] = useState({ monthly: initial.monthly, quarterly: initial.quarterly, yearly: initial.yearly })
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState("")
  const none = !settings.monthly && !settings.quarterly && !settings.yearly

  async function save(next: typeof settings) {
    setSettings(next)
    setState("saving")
    try {
      const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, t: token }) })
      const body = (await res.json()) as { ok: boolean; error?: string }
      if (!body.ok) throw new Error(body.error || "Could not save")
      setState("saved")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save")
      setState("error")
    }
  }

  return (
    <div>
      <h2 className="mb-2 font-semibold text-foreground">Send me a recap</h2>
      <ul className="space-y-2">
        {OPTIONS.map((o) => (
          <li key={o.key}>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:bg-muted">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-primary" checked={settings[o.key]} onChange={(e) => save({ ...settings, [o.key]: e.target.checked })} />
              <span>
                <span className="block font-semibold text-foreground">{o.label}</span>
                <span className="block text-sm text-muted-foreground">{o.text}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex min-h-9 flex-wrap items-center justify-between gap-3 text-sm">
        <span className={state === "error" ? "text-destructive" : "text-muted-foreground"}>
          {state === "saving" && "Saving…"}
          {state === "saved" && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Check className="h-4 w-4 text-primary" /> {none ? "Saved: you won't get any recap emails." : "Saved."}
            </span>
          )}
          {state === "error" && error}
        </span>
        {!none && (
          <button type="button" onClick={() => save({ monthly: false, quarterly: false, yearly: false })} className="text-muted-foreground underline hover:text-foreground">
            Unsubscribe from all
          </button>
        )}
      </div>
    </div>
  )
}
