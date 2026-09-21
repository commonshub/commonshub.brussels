"use client"

import { useState } from "react"
import { Check, Loader2, UserPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { type ShiftSignup, type ShiftSlot, slotId, slotLabel } from "@/lib/day"

export function ShiftSignupPanel({
  day,
  slots,
  initial,
  me,
  maxPerSlot,
}: {
  day: string
  slots: ShiftSlot[]
  initial: ShiftSignup[]
  /** The signed-in member's Discord id. */
  me: string
  maxPerSlot: number
}) {
  const [signups, setSignups] = useState<ShiftSignup[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (slot: ShiftSlot, action: "signup" | "cancel") => {
    setBusy(slotId(slot))
    setError(null)
    try {
      const response = await fetch(`/api/day/${day}/shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: slotId(slot), action }),
      })
      const data = (await response.json()) as { signups?: ShiftSignup[]; error?: string }
      if (!response.ok || !data.signups) throw new Error(data.error || "Something went wrong")
      setSignups(data.signups)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot) => {
        const id = slotId(slot)
        const people = signups.filter((s) => s.slot === id)
        const mine = people.some((s) => s.userId === me)
        const full = !mine && people.length >= maxPerSlot
        return (
          <div key={id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-semibold tabular-nums text-foreground">{slotLabel(slot)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {people.length === 0 ? "Nobody yet" : people.map((p) => p.name).join(", ")}
              </div>
            </div>
            {mine ? (
              <Button variant="outline" size="sm" disabled={busy === id} onClick={() => act(slot, "cancel")} title="Drop this shift">
                {busy === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                Yours
                <X className="h-3 w-3 opacity-60" />
              </Button>
            ) : (
              <Button size="sm" disabled={busy === id || full} onClick={() => act(slot, "signup")}>
                {busy === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {full ? "Full" : "Take it"}
              </Button>
            )}
          </div>
        )
      })}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Recorded on the Commons Hub relay and announced in #shifts on Discord, like the /shifts command.
      </p>
    </div>
  )
}
