"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"

import { useNostr } from "@/components/nostr-provider"
import type { Template } from "@/lib/nostr-conventions"
import settings from "@/settings/settings.json"

const MEMBER_ROLE = settings.discord.roles.member
const flagKey = (pubkey: string, discordId: string) => `nostr_linked_${discordId}_${pubkey.slice(0, 16)}`

/**
 * Makes sure every signed-in member's browser key can write to
 * relay.commonshub.brussels. The relay accepts a key when the site has
 * attested it (kind 31926) for a member, so the first time a member's key
 * is seen the site links it — once per key and account on this device —
 * and the browser publishes the member's profile if it has none. Without
 * this, a member's tags and comments stayed in their outbox, refused.
 */
export function MemberKeyLink() {
  const { data: session } = useSession()
  const nostr = useNostr()
  const user = session?.user as { discordId?: string; roles?: string[] } | undefined
  const isMember = !!user?.discordId && !!user.roles?.includes(MEMBER_ROLE)

  useEffect(() => {
    if (!isMember || !nostr.ready || !nostr.pubkey || !user?.discordId) return
    const key = flagKey(nostr.pubkey, user.discordId)
    try {
      if (window.localStorage.getItem(key)) return
    } catch {
      /* no storage: link every visit, it is idempotent */
    }
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch("/api/nostr/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pubkey: nostr.pubkey }),
        })
        const data = (await response.json()) as { profile?: Template | null; relays?: string[] }
        if (!response.ok || cancelled) return
        if (data.profile) await nostr.signAndPublish(data.profile, data.relays ?? []).catch(() => undefined)
        try {
          window.localStorage.setItem(key, new Date().toISOString())
        } catch {
          /* ignore */
        }
      } catch (error) {
        console.warn("[nostr] could not link this key:", error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isMember, nostr, user?.discordId])

  return null
}
