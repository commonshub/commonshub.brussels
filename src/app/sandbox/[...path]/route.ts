import * as fs from "fs"
import * as path from "path"
import { NextRequest, NextResponse } from "next/server"

import { CONTENT_TYPES, checkAccessToken, getPage, pageFilePath, sandboxCsp, withBridge } from "@/lib/member-pages"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The files of members' pages (lib/member-pages.ts), served sandboxed:
 *   /sandbox/<username>/<slug>/index.html         a public page (and its other files beside it)
 *   /sandbox/t/<token>/<username>/<slug>/<file>   a members-only one
 * Every answer carries the sandbox CSP, so even opened directly a page runs
 * with an opaque origin, away from the viewer's cookies and keys.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path ?? []
  let token: string | null = null
  let rest = segments
  if (segments[0] === "t") {
    token = segments[1] ?? ""
    rest = segments.slice(2)
  }
  const [username, slug, ...fileParts] = rest
  const page = username && slug ? getPage(username, slug) : null
  if (!page) return notFound()
  if (page.visibility !== "public" && !(token && checkAccessToken(token, page.username, page.slug))) {
    return new NextResponse("This page is for members. Open it from commonshub.brussels/members/" + page.username + "/" + page.slug, {
      status: 403,
      headers: headers(request, "text/plain; charset=utf-8"),
    })
  }

  // /sandbox/<u>/<slug> → its index.html, so relative paths resolve inside the folder.
  if (fileParts.length === 0) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname.replace(/\/$/, "")}/index.html`, origin(request)), 308)
  }
  const file = fileParts.join("/")
  const fsPath = pageFilePath(page, file)
  if (!fsPath || !fs.existsSync(fsPath)) return notFound()
  const type = CONTENT_TYPES[path.extname(fsPath).toLowerCase()] ?? "application/octet-stream"

  if (file === "index.html") {
    const html = withBridge(fs.readFileSync(fsPath, "utf-8"))
    return new NextResponse(html, { headers: headers(request, type) })
  }

  // Videos and audio need byte ranges to seek (and Safari to play at all).
  const size = fs.statSync(fsPath).size
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/)
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    const body = fs.readFileSync(fsPath).subarray(start, end + 1)
    return new NextResponse(body, {
      status: 206,
      headers: { ...headers(request, type), "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(body.length), "Accept-Ranges": "bytes" },
    })
  }
  return new NextResponse(fs.readFileSync(fsPath), { headers: { ...headers(request, type), "Content-Length": String(size), "Accept-Ranges": "bytes" } })
}

function origin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
  return `${proto.split(",")[0]}://${host.split(",")[0]}`
}

function headers(request: NextRequest, type: string): Record<string, string> {
  return {
    "Content-Type": type,
    "Content-Security-Policy": sandboxCsp(origin(request)),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, max-age=60",
    // The page's own scripts fetch its data files from its opaque origin. Never with credentials.
    "Access-Control-Allow-Origin": "*",
  }
}

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
