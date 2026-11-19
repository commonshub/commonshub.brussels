"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"

/**
 * For someone signed in with an email code: link their Discord account. The site remembers who
 * asked (POST /api/account/link-discord), then they sign in with Discord as usual, which links
 * the two (their Odoo contact too).
 */
export function LinkDiscordCard() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function start() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/account/link-discord", { method: "POST" }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok || !data.ok) {
      setBusy(false)
      return setError(data.error || "Something went wrong, please try again.")
    }
    await signIn("discord", { callbackUrl: "/?linked=discord" })
  }
  return (
    <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-[#5865F2] p-5 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brandkit/discord-white.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full bg-[#5865F2] p-1.5" />
      <span className="flex-1">
        <span className="block font-bold text-foreground">Link your Discord account</span>
        <span className="block text-sm text-muted-foreground">The community lives on Discord: link yours to sign in with it, join the conversations and earn tokens.</span>
        {error && <span className="mt-1 block text-sm text-destructive">{error}</span>}
      </span>
      <button type="button" onClick={start} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}Link Discord
      </button>
    </div>
  )
}
