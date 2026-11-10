"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2 } from "lucide-react"

import { AddEmailCard } from "@/components/dashboard/add-email"

/**
 * On the homepage for someone signed in without the member role: if they
 * already pay, the site finds their membership and gives them the role
 * (lib/member-activation.ts): by their Discord email, else by the address
 * they pay with, confirmed with a code.
 */
export function ActivateMembership({ username }: { username: string }) {
  const router = useRouter()
  const [step, setStep] = useState<"ask" | "busy" | "email">("ask")
  const [error, setError] = useState("")

  async function find() {
    setStep("busy")
    setError("")
    try {
      const res = await fetch("/api/membership/activate", { method: "POST" })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; needEmail?: boolean; error?: string }
      if (body.ok) return router.refresh()
      if (body.needEmail) return setStep("email")
      throw new Error(body.error || "Something went wrong")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStep("ask")
    }
  }

  return (
    <aside className="border-b border-border bg-primary/5">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <KeyRound className="h-6 w-6 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 basis-60 text-foreground">
            <span className="font-semibold">Hi {username}, you don&apos;t have member access yet.</span>{" "}
            <span className="text-muted-foreground">Already paying for a membership? We&apos;ll find it and let you in.</span>
          </p>
          {step !== "email" && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={find} disabled={step === "busy"} className="flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {step === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find my membership"}
              </button>
              <Link href="/membership" className="text-sm text-primary underline">
                Become a member
              </Link>
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {step === "email" && <AddEmailCard variant="activate" />}
      </div>
    </aside>
  )
}
