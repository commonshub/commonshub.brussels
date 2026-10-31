"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Mail } from "lucide-react"

const COPY = {
  partner: {
    title: "What's your email?",
    intro: "We don't have one for your membership: it's for your invoices and your monthly recap.",
  },
  membership: {
    title: "Which email do you pay with?",
    intro: "If your membership is under another address than your Discord one, confirm it and we'll find your plan.",
  },
}

/**
 * On the dashboard when chb has no email for the member's partner: add one,
 * proved with a code. Or (`membership`), when we can't find their plan: the
 * address they pay with, which then finds it.
 */
export function AddEmailCard({ variant = "partner" }: { variant?: keyof typeof COPY }) {
  const router = useRouter()
  const [found, setFound] = useState<boolean | null>(null)
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
      const body = (await res.json()) as { ok: boolean; error?: string; member?: boolean }
      if (!body.ok) throw new Error(body.error || "Something went wrong")
      if (step === "code") {
        setFound(!!body.member)
        if (body.member && variant === "membership") router.refresh()
      }
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
        <Check className="h-6 w-6 shrink-0 text-primary" />{" "}
        {variant === "partner"
          ? "Thanks! Your email is on its way to your membership."
          : found
            ? "Found it: your plan is on its way."
            : "Thanks! We don't see a membership with this address yet. Write to hello@commonshub.brussels and we'll sort it out."}
      </div>
    )

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 p-5">
      <div className="flex items-start gap-4">
        <Mail className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground">{step === "email" ? COPY[variant].title : `Enter the code we sent to ${email}`}</p>
          <p className="text-sm text-muted-foreground">
            {step === "email" ? COPY[variant].intro : "Check your inbox (and spam). The code is valid for about fifteen minutes."}
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
