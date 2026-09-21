"use client"

import { useState } from "react"
import { Check, Loader2, UserPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ShiftSignup, ShiftSlot } from "@/lib/day"

export function ShiftSignupPanel({
  day,
  slots,
  initial,
  me,
}: {
  day: string
  slots: ShiftSlot[]
  initial: ShiftSignup[]
  /** The signed-in member's Discord id. */
  me: string
}) {
  const [signups, setSignups] = useState<ShiftSignup[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const act = async (slot: ShiftSlot, action: "signup" | "cancel") => {
    setBusy(slot.id)
    setError(null)
    try {
      const response = await fetch(`/api/day/${day}/shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: slot.id, action }),
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
    <div className="flex flex-col gap-3">
      {slots.map((slot) => {
        const people = signups.filter((s) => s.slot === slot.id)
        const mine = people.some((s) => s.userId === me)
        return (
          <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div>
              <div className="font-semibold text-foreground">
                {slot.label} <span className="font-normal text-muted-foreground">· {slot.time}</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {people.length === 0 ? "Nobody yet" : people.map((p) => p.name).join(", ")}
              </div>
            </div>
            {mine ? (
              <Button variant="outline" size="sm" disabled={busy === slot.id} onClick={() => act(slot, "cancel")}>
                {busy === slot.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                You&apos;re on it
                <X className="h-3 w-3 opacity-60" />
              </Button>
            ) : (
              <Button size="sm" disabled={busy === slot.id} onClick={() => act(slot, "signup")}>
                {busy === slot.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Take this shift
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
        Sign-ups are posted in the #shifts channel on Discord, so everyone sees the same list.
      </p>
    </div>
  )
}
