"use client"

import { useState } from "react"

import type { Attribution } from "@/lib/fridge-thanks"

/**
 * After paying: would you like to show up as a donor (with the names the
 * payment came with, or one of your own), and the newsletter. Nothing is
 * required: the donation is done either way.
 */
export function ThanksForm({
  sessionId,
  options,
  newsletter,
  subscribeUrl,
}: {
  sessionId: string
  options: Array<{ value: Attribution; label: string }>
  /** "form": an email field, added to the newsletter from here; "link": a link to subscribe on Paragraph. */
  newsletter: "form" | "link"
  subscribeUrl: string
}) {
  const [show, setShow] = useState<Attribution>("anonymous")
  const [other, setOther] = useState("")
  const [wantsNewsletter, setWantsNewsletter] = useState(false)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string; name?: string | null; newsletter?: string }>({ kind: "idle" })

  async function save() {
    setState({ kind: "sending" })
    try {
      const res = await fetch("/api/fridge/thanks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, show, other, newsletter: newsletter === "form" && wantsNewsletter, email }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string; name?: string | null; newsletter?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not save")
      setState({ kind: "done", name: data.name, newsletter: data.newsletter })
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Could not save" })
    }
  }

  if (state.kind === "done") {
    return (
      <div className="mt-6 rounded-xl border border-primary bg-primary/5 p-4 text-foreground" role="status">
        {state.name ? `We'll thank you as ${state.name}.` : "You won't be named."}
        {state.newsletter === "subscribed" && " You're on the newsletter."}
        {state.newsletter === "failed" && (
          <>
            {" "}We could not add you to the newsletter:{" "}
            <a href={subscribeUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
              subscribe here
            </a>
            .
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-5 rounded-xl border border-border bg-card p-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium text-foreground">Would you like to show up as a donor?</span>
        <select
          value={show}
          onChange={(e) => setShow(e.target.value as Attribution)}
          className="h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {show === "other" && (
        <input
          type="text"
          value={other}
          maxLength={40}
          autoFocus
          onChange={(e) => setOther(e.target.value)}
          placeholder="A name, a group…"
          className="h-11 rounded-lg border border-border bg-background px-3 text-base"
          aria-label="Name to show"
        />
      )}

      {newsletter === "form" ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={wantsNewsletter} onChange={(e) => setWantsNewsletter(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
            <span className="text-foreground">
              Send me the newsletter
              <span className="block text-sm text-muted-foreground">News and events from the hub.</span>
            </span>
          </label>
          {wantsNewsletter && (
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="h-11 rounded-lg border border-border bg-background px-3 text-base"
              aria-label="Email address for the newsletter"
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Want to hear what happens at the hub?{" "}
          <a href={subscribeUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
            Subscribe to our newsletter →
          </a>
        </p>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <button type="button" onClick={save} disabled={state.kind === "sending"} className="h-12 rounded-lg bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
        {state.kind === "sending" ? "Saving…" : "Save"}
      </button>
    </div>
  )
}
