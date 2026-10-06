import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * What the big screen's browser reports about itself (ScreenReport in components/screen/screen-live.tsx:
 * page loads, errors, unloads), written to the server log as one line each,
 * so a TV that misbehaves (it reloaded every few seconds) can be diagnosed
 * without a keyboard on it. No cookies, no personal data: the page, the
 * event, the browser's user agent. At most 600 lines a minute.
 */
let minute = 0
let lines = 0

export async function POST(request: Request) {
  const now = Math.floor(Date.now() / 60_000)
  if (now !== minute) {
    minute = now
    lines = 0
  }
  if (++lines > 600) return new NextResponse(null, { status: 204 })
  const raw = (await request.text().catch(() => "")).slice(0, 2000)
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    body = { event: "unparsable", raw: raw.slice(0, 200) }
  }
  const clean = (v: unknown, max = 300) => String(v ?? "").replace(/\s+/g, " ").slice(0, max)
  console.log(
    `[screen] ${clean(body.event, 20)} ${clean(body.path, 80)} ${Object.entries(body)
      .filter(([k]) => !["event", "path"].includes(k))
      .map(([k, v]) => `${k}=${clean(v)}`)
      .join(" ")}`,
  )
  return new NextResponse(null, { status: 204 })
}
