"use client"

import { useEffect, useRef, useState } from "react"
import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { discordText, emailText, parseAction, type ActionContext, type PageAction } from "@/lib/member-page-actions"
import { bridgeAllows } from "@/lib/member-pages-bridge"

export interface Viewer {
  signedIn: boolean
  username?: string
  displayName?: string
  member: boolean
  steward: boolean
}

export interface FramePage {
  username: string
  slug: string
  title: string
  /** The channel chb.discord.send({ to: "channel" }) posts in. */
  channel?: string
}

type Pending = { action: PageAction; resolve: (r: { value?: unknown; error?: string }) => void }

/**
 * A member's page, in a sandboxed frame (lib/member-pages.ts for the model).
 * The frame talks to us through postMessage only, and we answer: who is
 * looking, GET reads of /data and /opendata made with the viewer's session
 * (what they could open themselves), its height, and actions
 * (lib/member-page-actions.ts) that we send only once the viewer confirmed
 * them in our own dialog, which the frame can't draw on or click. Messages
 * from anything but this frame are ignored.
 */
export function MemberPageFrame({ src, page, viewer, fill = false }: { src: string; page: FramePage; viewer: Viewer; fill?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(600)
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  pendingRef.current = pending

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      const win = frame.current?.contentWindow
      if (!win || event.source !== win) return
      const data = (event.data ?? {}) as { chb?: string; id?: number; path?: string; value?: number; kind?: string; data?: unknown }
      const reply = (value: unknown, error?: string) => win.postMessage({ chbReply: true, id: data.id, value, ...(error ? { error } : {}) }, "*")
      if (data.chb === "height" && typeof data.value === "number") {
        setHeight(Math.min(Math.max(200, data.value), 30000))
      } else if (data.chb === "me") {
        reply(viewer)
      } else if (data.chb === "fetch") {
        const p = String(data.path ?? "")
        if (!bridgeAllows(p)) return reply(null, `chb.fetch reads /data/… and /opendata/… only (got ${p.slice(0, 80)})`)
        try {
          const res = await fetch(p, { credentials: "same-origin", redirect: "error" })
          if (!res.ok) return reply(null, `${res.status} ${res.statusText}`)
          reply(await res.text())
        } catch (error) {
          reply(null, error instanceof Error ? error.message : "fetch failed")
        }
      } else if (data.chb === "action") {
        // One question at a time; a page can't stack dialogs.
        if (pendingRef.current) return reply(null, "Another send is waiting for the viewer")
        let action: PageAction
        try {
          action = parseAction(data.kind, data.data)
        } catch (error) {
          return reply(null, error instanceof Error ? error.message : "Invalid action")
        }
        if (action.kind === "discord" && action.to === "channel" && !page.channel) return reply(null, "This page has no Discord channel to post in")
        const next: Pending = { action, resolve: ({ value, error }) => reply(value ?? null, error) }
        pendingRef.current = next
        setPending(next)
      }
    }
    window.addEventListener("message", onMessage)
    // The frame may have asked before we listened: it asks again on hello.
    frame.current?.contentWindow?.postMessage({ chbHello: true }, "*")
    return () => window.removeEventListener("message", onMessage)
  }, [viewer, page.channel])

  const done = (r: { value?: unknown; error?: string }) => {
    pending?.resolve(r)
    pendingRef.current = null
    setPending(null)
  }

  return (
    <>
      <iframe
        ref={frame}
        src={src}
        title={page.title}
        // Belt and braces with the CSP sandbox the files are served with: never allow-same-origin.
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"
        allow="fullscreen; autoplay"
        referrerPolicy="no-referrer"
        onLoad={() => frame.current?.contentWindow?.postMessage({ chbHello: true }, "*")}
        className="block w-full border-0 bg-white"
        // Full screen: the frame is the window and scrolls itself.
        style={fill ? { height: "100%" } : { height }}
      />
      {pending && <ConfirmSend pending={pending} page={page} viewer={viewer} onDone={done} />}
    </>
  )
}

function ConfirmSend({ pending, page, viewer, onDone }: { pending: Pending; page: FramePage; viewer: Viewer; onDone: (r: { value?: unknown; error?: string }) => void }) {
  const { action } = pending
  const [armed, setArmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  // A beat before Send works: a page can't time a click onto it.
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 1200)
    return () => clearTimeout(t)
  }, [])

  const ctx: ActionContext = {
    pageTitle: page.title,
    pageUrl: `https://commonshub.brussels/members/${page.username}/${page.slug}`,
    author: page.username,
    sender: viewer.username ?? "you",
  }
  const to = action.kind === "email" ? "hello@commonshub.brussels" : action.to === "author" ? `@${page.username}, in a Discord DM` : `#${page.channel} on Discord`
  const preview = action.kind === "email" ? (({ subject, text }) => `Subject: ${subject}\n\n${text}`)(emailText(action, ctx)) : discordText(action, ctx)

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch("/api/member-pages/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: page.username, slug: page.slug, kind: action.kind, data: action }),
      })
      const body = (await res.json().catch(() => ({}))) as { sent?: string; error?: string }
      if (!res.ok) {
        setFailed(body.error ?? "Sending failed")
        setSending(false)
        return
      }
      onDone({ value: { sent: body.sent } })
    } catch {
      setFailed("Sending failed")
      setSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onDone({ error: failed ?? "Cancelled" })}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{viewer.signedIn ? `Send this as @${viewer.username}?` : "Log in to send this"}</DialogTitle>
          <DialogDescription>
            &ldquo;{page.title}&rdquo;, a page by @{page.username}, wants to send this {viewer.signedIn ? "in your name" : "once you are logged in"} to {to}.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground">{preview}</pre>
        {failed && <p className="text-sm text-destructive">{failed}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onDone({ error: failed ?? "Cancelled" })}>
            Cancel
          </Button>
          {viewer.signedIn ? (
            <Button onClick={send} disabled={!armed || sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          ) : (
            <Button onClick={() => signIn("discord")}>Log in with Discord</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
