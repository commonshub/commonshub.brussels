"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"

/** On the steward's phone: sign in if needed, check the code matches the tablet's, and approve. */
export function PairApprove({ signedIn, steward, id, code: initialCode, expired }: { signedIn: boolean; steward: boolean; id?: string; code?: string; expired: boolean }) {
  const [code, setCode] = useState(initialCode ?? "")
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string }>({ kind: "idle" })

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={() => signIn("discord", { callbackUrl: window.location.href })}
        className="mt-6 h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground"
      >
        Sign in with Discord to pair it
      </button>
    )
  }
  if (!steward) return <p className="mt-6 rounded-lg bg-muted p-4 text-foreground">Only a steward can pair the hub&apos;s tablet.</p>
  if (state.kind === "done") {
    return (
      <p role="status" className="mt-6 rounded-lg border border-primary bg-primary/5 p-4 text-foreground">
        Paired. The tablet will reload with members&apos; data in a few seconds.
      </p>
    )
  }

  async function approve() {
    setState({ kind: "sending" })
    try {
      const res = await fetch("/api/tablet/pair", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { code }) })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not pair the tablet")
      setState({ kind: "done" })
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Could not pair the tablet" })
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {expired && <p className="text-sm text-destructive">That QR code has expired. Show a new one on the tablet, or type its code below.</p>}
      {id && !expired ? (
        <p className="text-foreground">
          Check that the tablet shows this code: <span className="font-mono text-2xl font-bold tracking-widest">{code}</span>
        </p>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-foreground">The 6-digit code on the tablet</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            className="h-14 rounded-lg border border-border bg-background px-3 text-center font-mono text-2xl tracking-widest"
            aria-label="Code shown on the tablet"
          />
        </label>
      )}
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <button
        type="button"
        onClick={approve}
        disabled={state.kind === "sending" || (!id && code.replace(/\D/g, "").length !== 6)}
        className="h-12 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50"
      >
        {state.kind === "sending" ? "Pairing…" : "Pair this tablet"}
      </button>
    </div>
  )
}
