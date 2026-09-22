"use client"

import { useEffect, useRef, useState } from "react"
import { Check, KeyRound, Loader2, UserPlus, Users, X } from "lucide-react"

import { useNostr } from "@/components/nostr-provider"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { type ShiftSlot, type Signup, type Template, slotCode, slotLabel } from "@/lib/nostr-conventions"

interface Person {
  id: string
  name: string
}

/**
 * Taking a shift, the Nostr way: this browser holds the member's key. On
 * first use the site links the key to their Discord account (an
 * attestation under the site's key) and the browser publishes the member's
 * profile; every sign-up is then an RSVP signed here and sent to the relays
 * directly, with the site only announcing it afterwards.
 *
 * A steward can also sign another member up (or cancel for them): the RSVP
 * is still signed here, with the steward's key, and names the attendee.
 */
export function ShiftSignupPanel({
  day,
  slots,
  initial,
  me,
  maxPerSlot,
  relays,
  steward = false,
  memberRoleId,
}: {
  day: string
  slots: ShiftSlot[]
  initial: Signup[]
  /** The signed-in member's Discord id. */
  me: string
  maxPerSlot: number
  relays: string[]
  /** The signed-in member holds a steward role: may act for others. */
  steward?: boolean
  /** Discord role whose members a steward can pick from. */
  memberRoleId?: string
}) {
  const nostr = useNostr()
  const [signups, setSignups] = useState<Signup[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState<"pending" | "ok" | "failed">("pending")
  const [members, setMembers] = useState<Person[] | null>(null)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
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

  // Stewards get the member list for the picker, fetched once when first opened.
  const loadMembers = async () => {
    if (members || !memberRoleId) return
    try {
      const response = await fetch(`/api/discord/role-members?roleId=${memberRoleId}`)
      const data = (await response.json()) as { members?: Array<{ id: string; displayName: string; username: string }> }
      setMembers((data.members ?? []).map((m) => ({ id: m.id, name: m.displayName || m.username })).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) {
      console.warn("[shifts] could not load members:", e)
      setMembers([])
    }
  }

  /** Sign and publish an RSVP for `person` (someone else, stewards only) or for me. */
  const act = async (slot: ShiftSlot, action: "signup" | "cancel", person?: Person) => {
    const code = slotCode(slot)
    setBusy(`${code}:${person?.id ?? me}`)
    setError(null)
    try {
      const query = new URLSearchParams({ slot: code, action })
      if (person) query.set("for", person.id)
      const prep = await fetch(`/api/day/${day}/shift?${query}`)
      const { template, error: prepError } = (await prep.json()) as { template?: Template; error?: string }
      if (!prep.ok || !template) throw new Error(prepError || "Could not prepare the sign-up")
      const { event } = await nostr.signAndPublish(template, relays)
      const response = await fetch(`/api/day/${day}/shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: code, action, eventId: event.id, ...(person ? { for: person.id } : {}) }),
      })
      const data = (await response.json()) as { signups?: Signup[]; error?: string }
      if (!response.ok || !data.signups) throw new Error(data.error || "Something went wrong")
      // The relays can take a moment to serve the new RSVP back; reflect it now.
      const attendee = person?.id ?? me
      const rest = data.signups.filter((s) => !(s.slotCode === code && (s.discordId === attendee || (!person && s.pubkey === nostr.pubkey))))
      const added: Signup = person
        ? { pubkey: nostr.pubkey, discordId: person.id, name: person.name, slotCode: code, day, at: new Date().toISOString(), signedBy: { pubkey: nostr.pubkey, discordId: me, name: "you" } }
        : { pubkey: nostr.pubkey, discordId: me, name: "You", slotCode: code, day, at: new Date().toISOString() }
      setSignups(action === "signup" ? [...rest, added] : rest)
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
        const roomForOthers = people.length < maxPerSlot
        const taken = new Set(people.map((p) => p.discordId))
        return (
          <div key={code} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold tabular-nums text-foreground">{slotLabel(slot)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {people.length === 0
                    ? "Nobody yet"
                    : people.map((p, i) => (
                        <span key={`${p.discordId ?? p.pubkey}-${i}`}>
                          {i > 0 && ", "}
                          {p.name}
                          {p.signedBy && <span className="opacity-70"> (by {p.signedBy.name})</span>}
                          {steward && p.discordId && p.discordId !== me && (
                            <button
                              type="button"
                              className="ml-0.5 inline-flex align-middle text-muted-foreground hover:text-destructive"
                              title={`Cancel ${p.name}'s shift`}
                              disabled={busy === `${code}:${p.discordId}`}
                              onClick={() => act(slot, "cancel", { id: p.discordId!, name: p.name })}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {steward && memberRoleId && (
                  <Popover
                    open={pickerFor === code}
                    onOpenChange={(open) => {
                      setPickerFor(open ? code : null)
                      if (open) loadMembers()
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!roomForOthers || !nostr.ready || busy?.startsWith(`${code}:`)} title="Sign someone else up (steward)">
                        <Users className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <Command>
                        <CommandInput placeholder="Sign up a member…" />
                        <CommandList>
                          <CommandEmpty>{members === null ? "Loading members…" : "No member found."}</CommandEmpty>
                          <CommandGroup>
                            {(members ?? [])
                              .filter((m) => !taken.has(m.id))
                              .map((m) => (
                                <CommandItem
                                  key={m.id}
                                  value={`${m.name} ${m.id}`}
                                  onSelect={() => {
                                    setPickerFor(null)
                                    act(slot, "signup", m)
                                  }}
                                >
                                  {m.name}
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
                {mine ? (
                  <Button variant="outline" size="sm" disabled={busy === `${code}:${me}`} onClick={() => act(slot, "cancel")} title="Drop this shift">
                    {busy === `${code}:${me}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                    Yours
                    <X className="h-3 w-3 opacity-60" />
                  </Button>
                ) : (
                  <Button size="sm" disabled={busy === `${code}:${me}` || full || !nostr.ready} onClick={() => act(slot, "signup")}>
                    {busy === `${code}:${me}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {full ? "Full" : "Take it"}
                  </Button>
                )}
              </div>
            </div>
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
          {steward && " As a steward you can also sign other members up, or cancel for them."}
        </span>
      </p>
    </div>
  )
}
