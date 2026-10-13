"use client"

import { useEffect, useRef, useState } from "react"
import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"

/** Discord login that can also add the member to our server (guilds.join). */
const SCOPE = "identify email guilds guilds.members.read guilds.join"

/** Log in with Discord, then the member role is given right away. */
export function WelcomeClaim({ sessionId, token, user }: { sessionId: string | null; token: string | null; user: { name: string; image: string | null } | null }) {
  const [state, setState] = useState<{ kind: "idle" | "working" | "done" | "error"; message?: string; relogin?: boolean }>({ kind: "idle" })
  const tried = useRef(false)
  const proof = token ? { t: token } : sessionId ? { session_id: sessionId } : null

  const claim = async () => {
    if (!proof) return
    setState({ kind: "working" })
    try {
      const res = await fetch("/api/membership/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(proof) })
      const data = (await res.json()) as { ok?: boolean; error?: string; relogin?: boolean }
      if (data.relogin) return setState({ kind: "error", message: data.error, relogin: true })
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong")
      setState({ kind: "done" })
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "Something went wrong" })
    }
  }

  // Back from the Discord login: claim the role straight away.
  useEffect(() => {
    if (user && proof && !tried.current) {
      tried.current = true
      claim()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (!proof) {
    return (
      <p className="mt-8 rounded-xl border border-border bg-muted/50 p-5 text-muted-foreground">
        To get your member role on Discord, use the link in your onboarding email.
      </p>
    )
  }
  return (
    <div className="mt-8 rounded-xl border border-primary bg-primary/5 p-6">
      {state.kind === "done" ? (
        <>
          <h2 className="text-xl font-semibold text-foreground">🔑 You're a member on Discord{user?.name ? `, ${user.name}` : ""}!</h2>
          <p className="mt-2 text-muted-foreground">You can now open the door from the #door channel, and see all the members' channels.</p>
          <Button asChild className="mt-4">
            <a href="https://discord.com/channels/1280532848604086365/1306678821751230514" target="_blank" rel="noopener noreferrer">
              Open Discord
            </a>
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-foreground">One last step: log in with Discord</h2>
          <p className="mt-2 text-muted-foreground">
            Discord is where the community talks, plans and asks for help, and it's how you open the door. Log in with Discord and we'll add you to our
            server with the member role. No Discord account yet? You can create one for free on the next screen.
          </p>
          {state.kind === "error" && <p className="mt-3 text-sm text-destructive">{state.message}</p>}
          {user && !state.relogin ? (
            <Button className="mt-4" disabled={state.kind === "working"} onClick={claim}>
              {state.kind === "working" ? "Giving you the member role…" : "Get my member role"}
            </Button>
          ) : (
            <Button className="mt-4" onClick={() => signIn("discord", { callbackUrl: window.location.href }, { scope: SCOPE })}>
              Log in with Discord
            </Button>
          )}
        </>
      )}
    </div>
  )
}
