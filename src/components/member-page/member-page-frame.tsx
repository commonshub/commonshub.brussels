"use client"

import { useEffect, useRef, useState } from "react"

import { bridgeAllows } from "@/lib/member-pages-bridge"

export interface Viewer {
  signedIn: boolean
  username?: string
  displayName?: string
  member: boolean
  steward: boolean
}

/**
 * A member's page, in a sandboxed frame (lib/member-pages.ts for the model).
 * The frame talks to us through postMessage only, and we answer three
 * things: who is looking, GET reads of /data and /opendata made with the
 * viewer's session (what they could open themselves), and the frame's
 * height. Messages from anything but this frame are ignored.
 */
export function MemberPageFrame({ src, title, viewer, fullHeight = false }: { src: string; title: string; viewer: Viewer; fullHeight?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(fullHeight ? 0 : 600)

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      const win = frame.current?.contentWindow
      if (!win || event.source !== win) return
      const data = (event.data ?? {}) as { chb?: string; id?: number; path?: string; value?: number }
      const reply = (value: unknown, error?: string) => win.postMessage({ chbReply: true, id: data.id, value, ...(error ? { error } : {}) }, "*")
      if (data.chb === "height" && typeof data.value === "number") {
        if (!fullHeight) setHeight(Math.min(Math.max(200, data.value), 30000))
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
      }
    }
    window.addEventListener("message", onMessage)
    // The frame may have asked before we listened: it asks again on hello.
    frame.current?.contentWindow?.postMessage({ chbHello: true }, "*")
    return () => window.removeEventListener("message", onMessage)
  }, [viewer, fullHeight])

  return (
    <iframe
      ref={frame}
      src={src}
      onLoad={() => frame.current?.contentWindow?.postMessage({ chbHello: true }, "*")}
      title={title}
      // Belt and braces with the CSP sandbox the files are served with: never allow-same-origin.
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"
      allow="fullscreen; autoplay"
      referrerPolicy="no-referrer"
      className={`block w-full border-0 bg-white ${fullHeight ? "h-full" : ""}`}
      style={fullHeight ? undefined : { height }}
    />
  )
}
