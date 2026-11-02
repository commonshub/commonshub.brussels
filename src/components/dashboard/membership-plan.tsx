"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, Loader2 } from "lucide-react"

import { DEFAULT_MONTHLY, MONTHLY_PRICES, PAYMENT_LINKS, YEARLY_PRICES } from "@/lib/membership-application"
import type { MemberPlan, PlanCandidate } from "@/lib/member-plan"
import { AddEmailCard } from "./add-email"

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

/**
 * The member's plan. Individuals paying monthly by card choose €10, €15 or
 * €20 from their own income and situation, and can change it anytime (from
 * their next payment) or cancel it (it runs until the month paid for ends),
 * each after a confirmation; a yearly plan changes when it renews. Without a plan
 * they can start one: monthly by card (the membership's Stripe payment
 * link) or a year by bank transfer (/membership/pay/<amount>).
 */
export function MembershipPlanCard({ plan, candidate, discordId }: { plan: MemberPlan | null; candidate?: PlanCandidate | null; discordId?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {!plan ? (
        <>
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <CreditCard className="h-5 w-5 text-primary" /> Membership
          </h3>
          {candidate ? <IsThisYours candidate={candidate} discordId={discordId} /> : <StartMembership discordId={discordId} />}
        </>
      ) : (
        <YourPlan plan={plan} />
      )}
    </div>
  )
}

/**
 * Their plan in one line. A monthly card plan can be changed or cancelled
 * from here, each behind a confirmation that says when it takes effect.
 */
function YourPlan({ plan }: { plan: MemberPlan }) {
  const [amount, setAmount] = useState(plan.amount)
  const [endsOn, setEndsOn] = useState(plan.endsOn ?? null)
  const [step, setStep] = useState<null | "change" | { to: number } | "cancel">(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const next = plan.renewsOn ? longDate(plan.renewsOn) : null

  async function post(url: string, body: object, done: (res: { amount?: number; endsOn?: string | null }) => string | null) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Something went wrong")
      const text = done(json)
      setMessage(text ? { ok: true, text } : null)
      setStep(null)
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const change = (to: number) =>
    post("/api/membership/plan", { amount: to }, (r) => {
      setAmount(r.amount ?? to)
      return `Done: €${r.amount ?? to} a month from ${next ? `your next payment, on ${next}` : "your next payment"}.`
    })
  const cancel = (yes: boolean) =>
    post("/api/membership/cancel", { cancel: yes }, (r) => {
      setEndsOn(r.endsOn ?? null)
      return yes ? null : "Welcome back: your membership goes on."
    })

  const link = "text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60"
  const primary = "h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
  const secondary = "h-10 rounded-lg border-2 border-border px-4 text-sm font-semibold text-foreground disabled:opacity-60"

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <CreditCard className="h-5 w-5 text-primary" /> Membership
        </h3>
        <p className="text-foreground">
          <span className="font-bold">€{amount}</span> a {plan.interval}
          {plan.status !== "active" && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">{plan.status}</span>}
        </p>
      </div>
      {plan.pending ? (
        <p className="mt-1 text-sm text-muted-foreground">Thank you! Your payment is in. Its details show here within the hour.</p>
      ) : endsOn ? (
        <p className="mt-1 text-sm text-muted-foreground">Cancelled: you stay a member until {longDate(endsOn)}, with no further payment.</p>
      ) : (
        next && (
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.interval === "year" ? "Renews" : "Next payment"} on {next}
          </p>
        )
      )}

      {plan.canChange ? (
        step === null ? (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {endsOn ? (
              <button type="button" className={link} disabled={busy} onClick={() => cancel(false)}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Keep my membership"}
              </button>
            ) : (
              <>
                <button type="button" className={link} onClick={() => (setStep("change"), setMessage(null))}>
                  Change amount
                </button>
                <button type="button" className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline" onClick={() => (setStep("cancel"), setMessage(null))}>
                  Cancel membership
                </button>
              </>
            )}
          </div>
        ) : step === "change" ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">Pay what fits your income and situation.</p>
            <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Monthly amount">
              {MONTHLY_PRICES.map((p) => (
                <button
                  key={p.amount}
                  type="button"
                  role="radio"
                  aria-checked={amount === p.amount}
                  disabled={amount === p.amount}
                  onClick={() => setStep({ to: p.amount })}
                  className={`rounded-xl border-2 px-2 py-1.5 text-center text-sm transition ${amount === p.amount ? "border-primary bg-primary/10 font-bold text-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}
                >
                  <span className="block font-semibold text-foreground">€{p.amount}</span>
                  <span className="block text-xs">{p.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className={`${link} mt-2`} onClick={() => setStep(null)}>
              Never mind
            </button>
          </>
        ) : step === "cancel" ? (
          <Confirm
            text={`Cancel your membership? You stay a member${next ? ` until ${next}` : " until the end of the month you paid for"}, and you won't be charged again.`}
            busy={busy}
            yes="Yes, cancel"
            no="Keep it"
            onYes={() => cancel(true)}
            onNo={() => setStep(null)}
            primary={primary}
            secondary={secondary}
          />
        ) : (
          <Confirm
            text={`Pay €${step.to} a month instead of €${amount}? It applies from ${next ? `your next payment, on ${next}` : "your next payment"}.`}
            busy={busy}
            yes={`Yes, €${step.to} a month`}
            no="Back"
            onYes={() => change(step.to)}
            onNo={() => setStep("change")}
            primary={primary}
            secondary={secondary}
          />
        )
      ) : plan.pending ? null : plan.byName ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">To change it here, confirm the email you pay with.</p>
          <AddEmailCard variant="membership" />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {plan.interval === "year" ? "You paid for the year: you can change your plan when it renews." : "To change your plan, write to hello@commonshub.brussels."}
        </p>
      )}
      {message && <p className={`mt-2 text-sm ${message.ok ? "text-foreground" : "text-destructive"}`}>{message.text}</p>}
    </>
  )
}

function Confirm({ text, busy, yes, no, onYes, onNo, primary, secondary }: { text: string; busy: boolean; yes: string; no: string; onYes: () => void; onNo: () => void; primary: string; secondary: string }) {
  return (
    <div className="mt-3 rounded-xl bg-muted p-3">
      <p className="text-sm text-foreground">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={busy} onClick={onYes}>
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : yes}
        </button>
        <button type="button" className={secondary} disabled={busy} onClick={onNo}>
          {no}
        </button>
      </div>
    </div>
  )
}

const monthYear = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })

/** No plan found by their addresses, but one matches their name: ask them. "No" lets them start one. */
function IsThisYours({ candidate, discordId }: { candidate: PlanCandidate; discordId?: string }) {
  const router = useRouter()
  const [answer, setAnswer] = useState<"no" | "busy" | null>(null)
  const [error, setError] = useState("")

  async function yes() {
    setAnswer("busy")
    setError("")
    try {
      const res = await fetch("/api/membership/claim-name", { method: "POST" })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!body.ok) throw new Error(body.error || "Something went wrong")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setAnswer(null)
    }
  }

  if (answer === "no") return <StartMembership discordId={discordId} />
  return (
    <>
      <p className="mt-2 text-foreground">We found a membership with your name. Is it yours?</p>
      <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-foreground">
        <span className="text-2xl font-bold">€{candidate.amount}</span> a {candidate.interval}
        <span className="block text-sm text-muted-foreground">since {monthYear(candidate.since)}</span>
        {candidate.emailHint && <span className="block text-sm text-muted-foreground">paid with {candidate.emailHint}</span>}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={yes} disabled={answer === "busy"} className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
          {answer === "busy" ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Yes, that's me"}
        </button>
        <button type="button" onClick={() => setAnswer("no")} disabled={answer === "busy"} className="h-11 rounded-lg border-2 border-border px-4 font-semibold text-foreground">
          No, it&apos;s not
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </>
  )
}

/**
 * No plan found: start one, monthly by card or yearly by bank transfer. The
 * card checkout carries their Discord id (client_reference_id), so the Stripe
 * webhook links the payment to them and it shows here at once.
 */
function StartMembership({ discordId }: { discordId?: string }) {
  const [interval, setPeriod] = useState<"month" | "year">("month")
  const [monthly, setMonthly] = useState<number>(DEFAULT_MONTHLY)
  const [linking, setLinking] = useState(false)
  const prices = interval === "month" ? MONTHLY_PRICES : YEARLY_PRICES
  const chosen = interval === "month" ? monthly : monthly * 10
  const href = interval === "month" ? `${PAYMENT_LINKS[`individual${monthly}` as "individual10" | "individual15" | "individual20"].url}${discordId ? `?client_reference_id=discord_${discordId}` : ""}` : `/membership/pay/${chosen}`

  return (
    <>
      <p className="mt-2 text-foreground">You are not a member of the Commons Hub yet.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        You may have access as part of your organisation, but we encourage you to also become a member as an individual, to build your own relationship with the commons in
        Brussels. The commons needs your organisation. But it also needs you.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Just paid? It shows up here within a day. Already a member with another email?{" "}
        <button type="button" onClick={() => setLinking(!linking)} className="text-primary underline">
          Confirm it
        </button>
        . Questions?{" "}
        <a href="mailto:hello@commonshub.brussels" className="text-primary underline">
          hello@commonshub.brussels
        </a>
      </p>
      {linking && <AddEmailCard variant="membership" />}
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="How often you pay">
        {(
          [
            ["month", "Monthly, by card"],
            ["year", "Yearly, by transfer"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={interval === k}
            onClick={() => setPeriod(k)}
            className={`rounded-lg px-2 py-1.5 text-sm transition ${interval === k ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Pay what fits your income and situation.{interval === "year" ? " A year is ten months: two months free." : " You can change it anytime."}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={interval === "month" ? "Monthly amount" : "Yearly amount"}>
        {prices.map((p, i) => {
          const m = MONTHLY_PRICES[i].amount
          return (
            <button
              key={p.amount}
              type="button"
              role="radio"
              aria-checked={monthly === m}
              onClick={() => setMonthly(m)}
              className={`rounded-xl border-2 px-2 py-2 text-center text-sm transition ${monthly === m ? "border-primary bg-primary/10 font-bold text-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}
            >
              <span className="block text-base font-semibold text-foreground">€{p.amount}</span>
              <span className="block text-xs">{p.label}</span>
            </button>
          )
        })}
      </div>
      <a href={href} className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground transition hover:bg-primary/90">
        {interval === "month" ? `Pay €${chosen} a month by card` : `Pay €${chosen} for a year by transfer`}
      </a>
    </>
  )
}
