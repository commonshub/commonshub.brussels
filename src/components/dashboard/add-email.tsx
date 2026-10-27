"use client"

import { useState } from "react"
import { Check, Mail } from "lucide-react"

/** On the dashboard when chb has no email for the member's partner: add one, proved with a code. */
export function AddEmailCard() {
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "code" | "done">("email")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/members/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(step === "email" ? { email } : { email, code }) })
      const body = (await res.json()) as { ok: boolean; error?: string }
      if (!body.ok) throw new Error(body.error || "Something went wrong")
      setStep(step === "email" ? "code" : "done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  if (step === "done")
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-foreground">
        <Check className="h-6 w-6 shrink-0 text-primary" /> Thanks! Your email is on its way to your membership.
      </div>
    )

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 p-5">
      <div className="flex items-start gap-4">
        <Mail className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground">{step === "email" ? "What's your email?" : `Enter the code we sent to ${email}`}</p>
          <p className="text-sm text-muted-foreground">
            {step === "email" ? "We don't have one for your membership: it's for your invoices and your monthly recap." : "Check your inbox (and spam). The code is valid for about fifteen minutes."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {step === "email" ? (
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" autoComplete="email" className="min-w-0 basis-full rounded-lg border border-border bg-background px-3 py-2 text-[15px] sm:basis-auto sm:flex-1" />
            ) : (
              <input inputMode="numeric" pattern="\d{6}" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" autoComplete="one-time-code" className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-[15px] tracking-widest" />
            )}
            <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "…" : step === "email" ? "Send me a code" : "Confirm"}
            </button>
            {step === "code" && (
              <button type="button" onClick={() => (setStep("email"), setCode(""), setError(""))} className="text-sm text-muted-foreground underline">
                Change address
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </form>
  )
}
