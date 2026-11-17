"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Loader2, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Sign in: with Discord (members), or with an email address we know (one of
 * our contacts in Odoo) and a 6-digit code sent to it.
 */
export function SignInDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">{open && <SignInFlow />}</DialogContent>
    </Dialog>
  )
}

function SignInFlow() {
  const [step, setStep] = useState<"choose" | "email" | "code">("choose")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/auth/email-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })
      const data = await res.json().catch(() => ({ ok: false }))
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong, please try again.")
      setCode("")
      setStep("code")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setError(null)
    setBusy(true)
    const r = await signIn("email-code", { email, code, redirect: false }).catch(() => null)
    setBusy(false)
    if (r && !r.error) window.location.reload()
    else setError("That code isn't right, or it has expired: ask for a new one.")
  }

  if (step === "choose")
    return (
      <>
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>Members sign in with Discord. You can also sign in with the email address we know you by.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button className="w-full" onClick={() => signIn("discord", { callbackUrl: window.location.href })}>
            Sign in with Discord
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setStep("email")}>
            <Mail className="mr-2 h-4 w-4" /> Sign in with email
          </Button>
        </div>
      </>
    )

  if (step === "email")
    return (
      <>
        <DialogHeader>
          <DialogTitle>Sign in with email</DialogTitle>
          <DialogDescription>We&apos;ll send a 6-digit code to the address we have for you (on your invoices or membership).</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void sendCode()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="signin-email">Email address</Label>
            <Input id="signin-email" type="email" autoComplete="email" required value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => (setError(null), setStep("choose"))}>
              Back
            </Button>
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send me a code
            </Button>
          </div>
        </form>
      </>
    )

  return (
    <>
      <DialogHeader>
        <DialogTitle>Enter your code</DialogTitle>
        <DialogDescription>If {email} is in our books, a 6-digit code is on its way. It works for 10 minutes.</DialogDescription>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void verify()
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="signin-code">Code</Label>
          <Input
            id="signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            className="text-center font-mono text-2xl tracking-[0.4em]"
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void sendCode()}>
            Send a new code
          </Button>
          <Button type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          No email? Check your spam folder, or{" "}
          <button type="button" className="underline" onClick={() => (setError(null), setStep("email"))}>
            use another address
          </button>
          .
        </p>
      </form>
    </>
  )
}
