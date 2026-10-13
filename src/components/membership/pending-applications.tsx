"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { useNostr } from "@/components/nostr-provider"
import { Button } from "@/components/ui/button"
import { buildVouch, type PublicApplication } from "@/lib/membership-application"

type Row = PublicApplication & { vouchedBy: Array<{ discordId: string; name: string }> }

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" })

/** The applications, each with its answers, who vouched, and a button to vouch (members with tokens). */
export function PendingApplications({
  applications,
  me,
  canVouch,
  needed,
  sitePubkey,
  community,
  relays,
}: {
  applications: Row[]
  me: string
  canVouch: boolean
  needed: number
  sitePubkey: string
  community: { guildId: string; name: string }
  relays: string[]
}) {
  const nostr = useNostr()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  const vouch = async (a: Row) => {
    setBusy(a.id)
    setMessages((m) => ({ ...m, [a.id]: "" }))
    try {
      await nostr.signAndPublish(buildVouch(a.id, a.name, community, sitePubkey), relays)
      const res = await fetch("/api/membership/vouch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) })
      const data = (await res.json()) as { status?: string; vouchers?: string[]; error?: string }
      if (!res.ok) throw new Error(data.error || "Could not record the vouch")
      setMessages((m) => ({
        ...m,
        [a.id]: data.status === "approved" ? `Accepted! ${a.name} got the payment link.` : `Thanks! ${data.vouchers?.length ?? 1} of ${needed} vouches.`,
      }))
      router.refresh()
    } catch (error) {
      setMessages((m) => ({ ...m, [a.id]: error instanceof Error ? error.message : "Could not record the vouch" }))
    } finally {
      setBusy(null)
    }
  }

  if (applications.length === 0) return <p className="text-muted-foreground">No pending applications right now.</p>
  return (
    <ul className="flex flex-col gap-4">
      {!canVouch && (
        <li className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Only members who hold tokens can vouch. You earn tokens by contributing, for example by taking a <a href="/shifts" className="text-primary underline">shift</a>.
        </li>
      )}
      {applications.map((a) => {
        const mine = a.vouchedBy.some((v) => v.discordId === me)
        return (
          <li key={a.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-foreground">{a.name}</h2>
              <span className="text-sm text-muted-foreground">
                {a.type !== "individual" ? `${a.type}${a.people ? ` · ${a.people} people` : ""} · ` : ""}applied {when(a.submittedAt)}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              {[
                ["Website", a.website],
                ["How the community can help", a.needs.join("; ")],
                ["Can contribute", a.contribute],
                ["Heard about us", a.heardFrom],
                ["Knows at the hub", a.whoYouKnow],
                ["Anything else", a.notes],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-medium text-foreground">{k}</dt>
                    <dd className="whitespace-pre-line break-words text-muted-foreground">{v}</dd>
                  </div>
                ))}
            </dl>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">
                {a.status === "pending" ? `${a.vouchedBy.length} of ${needed} vouches` : a.status === "approved" ? "Accepted, waiting for the payment" : "Member 🎉"}
                {a.vouchedBy.length > 0 && <>: {a.vouchedBy.map((v) => v.name).join(", ")}</>}
              </span>
              {a.status === "pending" &&
                (mine ? (
                  <span className="text-sm font-medium text-primary">You vouched</span>
                ) : (
                  <Button size="sm" disabled={!canVouch || busy === a.id} onClick={() => vouch(a)}>
                    {busy === a.id ? "Vouching…" : `Vouch for ${a.name.split(" ")[0]}`}
                  </Button>
                ))}
            </div>
            {messages[a.id] && <p className="mt-2 text-sm text-muted-foreground">{messages[a.id]}</p>}
          </li>
        )
      })}
    </ul>
  )
}
