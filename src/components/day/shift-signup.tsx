"use client"

import { useEffect, useRef, useState } from "react"
import { Check, KeyRound, Loader2, UserPlus, X } from "lucide-react"

import { useNostr } from "@/components/nostr-provider"
import { Button } from "@/components/ui/button"
import { type ShiftSlot, type Signup, type Template, slotCode, slotLabel } from "@/lib/nostr-conventions"

/**
 * Taking a shift, the Nostr way: this browser holds the member's key. On
 * first use the site links the key to their Discord account (an
 * attestation under the site's key) and the browser publishes the member's
 * profile; every sign-up is then an RSVP signed here and sent to the relays
 * directly, with the site only announcing it afterwards.
 */
export function ShiftSignupPanel({
  day,
  slots,
  initial,
  me,
  maxPerSlot,
  relays,
}: {
  day: string
  slots: ShiftSlot[]
  initial: Signup[]
  /** The signed-in member's Discord id. */
  me: string
  maxPerSlot: number
  relays: string[]
}) {
  const nostr = useNostr()
  const [signups, setSignups] = useState<Signup[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState<"pending" | "ok" | "failed">("pending")
  const linking = useRef(false)

  // Link this key to the member once per page, and give it a profile if it has none.
  useEffect(() => {
    if (!nostr.ready || !nostr.pubkey || linking.current) return
    linking.current = true
    ;(async () => {
      try {
        const response = await fetch("/api/nostr/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pubkey: nostr.pubkey }) })
        const data = (await response.json()) as { profile?: Template | null; relays?: string[]; error?: string }
        if (!response.ok) throw new Error(data.error || "Could not link this key")
        if (data.profile) await nostr.signAndPublish(data.profile, data.relays ?? relays).catch((e) => console.warn("[nostr] profile not published:", e))
        setLinked("ok")
      } catch (e) {
        console.warn("[nostr] link failed:", e)
        setLinked("failed")
      }
    })()
  }, [nostr, relays])

  const act = async (slot: ShiftSlot, action: "signup" | "cancel") => {
    const code = slotCode(slot)
    setBusy(code)
    setError(null)
    try {
      const prep = await fetch(`/api/day/${day}/shift?slot=${code}&action=${action}`)
      const { template, error: prepError } = (await prep.json()) as { template?: Template; error?: string }
      if (!prep.ok || !template) throw new Error(prepError || "Could not prepare the sign-up")
      const { event } = await nostr.signAndPublish(template, relays)
      const response = await fetch(`/api/day/${day}/shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: code, action, eventId: event.id }),
      })
      const data = (await response.json()) as { signups?: Signup[]; error?: string }
      if (!response.ok || !data.signups) throw new Error(data.error || "Something went wrong")
      // The relays can take a moment to serve the new RSVP back; reflect it now.
      const rest = data.signups.filter((s) => !(s.pubkey === nostr.pubkey && s.slotCode === code))
      setSignups(action === "signup" ? [...rest, { pubkey: nostr.pubkey, discordId: me, name: "You", slotCode: code, day, at: new Date().toISOString() }] : rest)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot) => {
        const code = slotCode(slot)
        const people = signups.filter((s) => s.slotCode === code)
        const mine = people.some((s) => s.pubkey === nostr.pubkey || s.discordId === me)
        const full = !mine && people.length >= maxPerSlot
        return (
          <div key={code} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-semibold tabular-nums text-foreground">{slotLabel(slot)}</div>
              <div className="truncate text-xs text-muted-foreground">{people.length === 0 ? "Nobody yet" : people.map((p) => p.name).join(", ")}</div>
            </div>
            {mine ? (
              <Button variant="outline" size="sm" disabled={busy === code} onClick={() => act(slot, "cancel")} title="Drop this shift">
                {busy === code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                Yours
                <X className="h-3 w-3 opacity-60" />
              </Button>
            ) : (
              <Button size="sm" disabled={busy === code || full || !nostr.ready} onClick={() => act(slot, "signup")}>
                {busy === code ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
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
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Signed with your own key ({nostr.npub ? `${nostr.npub.slice(0, 12)}…` : "…"}) and recorded on the Commons Hub relay
          {linked === "failed" ? "; linking it to your Discord account failed, so the relay may refuse it" : linked === "ok" ? ", linked to your Discord account" : ""}. Announced in #shifts.
        </span>
      </p>
    </div>
  )
}
