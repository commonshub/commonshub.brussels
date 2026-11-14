"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

import { useNostr } from "@/components/nostr-provider"

/**
 * Delete one of your own annotations: a NIP-09 deletion request (kind 5)
 * for that event, signed with the same key. Only shown to its author.
 */
export function DeleteAnnotation({ eventId, author, relays }: { eventId: string; author: string; relays: string[] }) {
  const { pubkey, signAndPublish, forget } = useNostr()
  const router = useRouter()
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle")
  if (!pubkey || pubkey !== author) return null

  const remove = async () => {
    if (!window.confirm("Delete this annotation? It is withdrawn from the Commons Hub relays.")) return
    setState("deleting")
    try {
      await signAndPublish({ kind: 5, created_at: Math.floor(Date.now() / 1000), tags: [["e", eventId], ["k", "1111"]], content: "Annotation withdrawn" }, relays)
      forget([eventId])
      router.refresh()
    } catch {
      setState("error")
    }
  }

  return (
    <button type="button" onClick={remove} disabled={state === "deleting"} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
      {state === "deleting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {state === "error" ? "Could not delete" : "Delete"}
    </button>
  )
}
