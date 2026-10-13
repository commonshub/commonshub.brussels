/**
 * Pages that members publish on the site, usually through Elinor (the MCP
 * tool publish_member_page): an HTML page with its scripts, images and
 * videos, at /members/<username>/<slug>. Stewards can give one a short
 * address at the root of the site (/<alias>).
 *
 * The security model: a page is someone else's code running in front of a
 * signed-in member, whose browser holds their session cookie and, in this
 * origin's localStorage, their Nostr key. So the page never runs on this
 * origin. Its files are served under /sandbox/ with a CSP `sandbox` header
 * (and the iframe's sandbox attribute): the document gets an opaque origin,
 * so it can't read our cookies or localStorage, and our SameSite cookies are
 * not sent with its requests. Its CSP only lets it load from its own folder,
 * the open data and a few public CDNs: our API is out of reach. What it
 * may know about the viewer goes through the bridge in the parent page
 * (components/member-page/member-page-frame.tsx): who is looking, and GET
 * reads of /data and /opendata, which the viewer could read anyway.
 *
 * Storage: PAGES_DIR/<username>/<slug>/{page.json, files/…}, and
 * PAGES_DIR/aliases.json. A page is replaced whole when republished.
 */

import { createHmac, timingSafeEqual } from "crypto"
import * as fs from "fs"
import * as path from "path"

export const PAGES_DIR = process.env.PAGES_DIR || path.join(process.cwd(), "member-pages")

export type Visibility = "members" | "public"

export interface MemberPage {
  username: string
  slug: string
  title: string
  description?: string
  visibility: Visibility
  /** The author's Discord id: only they (or a steward) may replace or delete it. */
  discordId: string
  publishedAt: string
  updatedAt: string
  files: Array<{ path: string; size: number }>
  /** The channel chb.discord.send({ to: "channel" }) posts in, chosen by the author at publish (one they can post in). */
  discordChannel?: { id: string; name: string }
}

export interface PageFileInput {
  path: string
  /** The file's bytes, base64. */
  base64?: string
  /** Or text content (scripts, css, json, csv, svg). */
  text?: string
}

export const LIMITS = {
  html: 2 * 1024 * 1024,
  file: 25 * 1024 * 1024,
  total: 60 * 1024 * 1024,
  files: 100,
}

export const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".tsv": "text/tab-separated-values; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
}

export class PageError extends Error {}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const USERNAME_RE = /^[a-z0-9_.]{2,32}$/
const FILE_RE = /^(?:[A-Za-z0-9_][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_][A-Za-z0-9_.-]*$/

export const isSlug = (s: string) => SLUG_RE.test(s)
export const isUsername = (s: string) => USERNAME_RE.test(s) && !s.includes("..")

/** "My Data Viz!" → "my-data-viz" */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "")
}

/** A file path inside a page: relative, no "..", a known type. Returns the normalised path. */
export function checkFilePath(p: string): string {
  const clean = p.replace(/^\.?\//, "")
  if (!FILE_RE.test(clean) || clean.split("/").some((part) => part === "." || part === "..") || clean.length > 200)
    throw new PageError(`Invalid file path "${p}": use letters, digits, - _ . and / only, e.g. img/chart.png`)
  if (!CONTENT_TYPES[path.extname(clean).toLowerCase()]) throw new PageError(`File type not allowed: ${p} (allowed: ${Object.keys(CONTENT_TYPES).join(" ")})`)
  return clean
}

const pageDir = (username: string, slug: string) => path.join(PAGES_DIR, username, slug)

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T
  } catch {
    return null
  }
}

export function getPage(username: string, slug: string): MemberPage | null {
  if (!isUsername(username) || !isSlug(slug)) return null
  return readJson<MemberPage>(path.join(pageDir(username, slug), "page.json"))
}

export function listPages(username?: string): MemberPage[] {
  if (username !== undefined && !isUsername(username)) return []
  const users = username ? [username] : fs.existsSync(PAGES_DIR) ? fs.readdirSync(PAGES_DIR).filter(isUsername) : []
  const pages: MemberPage[] = []
  for (const u of users) {
    const dir = path.join(PAGES_DIR, u)
    if (!fs.existsSync(dir)) continue
    for (const slug of fs.readdirSync(dir).filter(isSlug)) {
      const page = getPage(u, slug)
      if (page) pages.push(page)
    }
  }
  return pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** The bytes of one of a page's files, or null. */
export function pageFilePath(page: MemberPage, file: string): string | null {
  let clean: string
  try {
    clean = checkFilePath(file)
  } catch {
    return null
  }
  if (!page.files.some((f) => f.path === clean)) return null
  return path.join(pageDir(page.username, page.slug), "files", clean)
}

/**
 * Publish (or replace) a page. The whole page is written to a new folder
 * first, then swapped in, so a reader never sees half of it.
 */
export function savePage(input: {
  username: string
  discordId: string
  slug: string
  title: string
  description?: string
  visibility?: Visibility
  html: string
  files?: PageFileInput[]
  /** Who may replace an existing page besides its author. */
  canOverride?: boolean
  /** Already checked (member-page-actions-server.ts checkPageChannel). */
  discordChannel?: { id: string; name: string }
  now?: Date
}): MemberPage {
  const { username, slug } = input
  if (!isUsername(username)) throw new PageError(`Invalid username "${username}"`)
  if (!isSlug(slug)) throw new PageError(`Invalid slug "${slug}": lowercase letters, digits and dashes, e.g. ${slugify(slug) || "my-chart"}`)
  const title = input.title.trim().slice(0, 140)
  if (!title) throw new PageError("A title is required")
  const html = Buffer.from(input.html, "utf-8")
  if (html.length > LIMITS.html) throw new PageError(`The HTML is ${(html.length / 1048576).toFixed(1)} MB; the limit is ${LIMITS.html / 1048576} MB. Put data in separate files.`)
  const files = input.files ?? []
  if (files.length > LIMITS.files) throw new PageError(`Too many files (${files.length}); the limit is ${LIMITS.files}`)

  const existing = getPage(username, slug)
  if (existing && existing.discordId !== input.discordId && !input.canOverride) throw new PageError("That page belongs to someone else")

  const written: Array<{ path: string; data: Buffer }> = [{ path: "index.html", data: html }]
  let total = html.length
  for (const f of files) {
    const p = checkFilePath(f.path)
    if (p === "index.html") throw new PageError("index.html is the page itself: pass it as html")
    if (written.some((w) => w.path === p)) throw new PageError(`Duplicate file ${p}`)
    if (typeof f.base64 !== "string" && typeof f.text !== "string") throw new PageError(`File ${p} needs base64 or text`)
    const data = typeof f.text === "string" ? Buffer.from(f.text, "utf-8") : Buffer.from(f.base64!, "base64")
    if (data.length > LIMITS.file) throw new PageError(`${p} is ${(data.length / 1048576).toFixed(1)} MB; the limit per file is ${LIMITS.file / 1048576} MB`)
    total += data.length
    if (total > LIMITS.total) throw new PageError(`The page is over ${LIMITS.total / 1048576} MB in all`)
    written.push({ path: p, data })
  }

  const now = (input.now ?? new Date()).toISOString()
  const page: MemberPage = {
    username,
    slug,
    title,
    ...(input.description?.trim() ? { description: input.description.trim().slice(0, 500) } : {}),
    visibility: input.visibility === "public" ? "public" : "members",
    discordId: existing?.discordId ?? input.discordId,
    publishedAt: existing?.publishedAt ?? now,
    updatedAt: now,
    files: written.map((w) => ({ path: w.path, size: w.data.length })),
    // Kept from the previous version unless a new one is given.
    ...(input.discordChannel ?? existing?.discordChannel ? { discordChannel: input.discordChannel ?? existing!.discordChannel } : {}),
  }

  const dir = pageDir(username, slug)
  const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`
  for (const w of written) {
    const target = path.join(tmp, "files", w.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, w.data)
  }
  fs.writeFileSync(path.join(tmp, "page.json"), JSON.stringify(page, null, 2))
  const old = `${dir}.old-${process.pid}-${Date.now()}`
  if (fs.existsSync(dir)) fs.renameSync(dir, old)
  fs.renameSync(tmp, dir)
  if (fs.existsSync(old)) fs.rmSync(old, { recursive: true, force: true })
  return page
}

export function deletePage(username: string, slug: string): boolean {
  const page = getPage(username, slug)
  if (!page) return false
  fs.rmSync(pageDir(username, slug), { recursive: true, force: true })
  const aliases = readAliases()
  for (const [alias, target] of Object.entries(aliases)) if (target.username === username && target.slug === slug) delete aliases[alias]
  writeAliases(aliases)
  return true
}

// ── short addresses, set by stewards ─────────────────────────────────────

/**
 * Top-level paths of the site, never usable as an alias: the folders of
 * src/app (a test keeps this list complete) and a few words kept for later.
 */
export const RESERVED = new Set([
  "api", "book", "brand", "calendar", "calendar.ics", "collectives", "community", "community.md", "contact", "contribute",
  "contributions", "coworking", "data", "debt", "docs", "donate", "economy", "economy.md", "events", "events.md", "expenses",
  "finance", "finance.md", "fiscal-sponsorship", "fridge", "handbook", "integrity", "llms.txt", "mcp", "members", "membership",
  "newsletter", "opendata", "opendata.md", "posters", "potluck", "reports", "robots.txt", "rooms", "rooms.md", "sandbox",
  "screen", "screens", "shifts", "sitemap.xml", "status", "status.json", "stewards", "tablet", "taxes", "today", "volunteer",
  "workshops", "apply", "admin", "login", "logout", "auth", "p", "pages", "static", "_next", "favicon.ico", "brandkit", "images",
])

export type Aliases = Record<string, { username: string; slug: string; setBy: string; setAt: string }>

const ALIASES_FILE = () => path.join(PAGES_DIR, "aliases.json")
export const readAliases = (): Aliases => readJson<Aliases>(ALIASES_FILE()) ?? {}
function writeAliases(aliases: Aliases) {
  fs.mkdirSync(PAGES_DIR, { recursive: true })
  const tmp = `${ALIASES_FILE()}.tmp-${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify(aliases, null, 2))
  fs.renameSync(tmp, ALIASES_FILE())
}

export function checkAlias(alias: string): void {
  if (!isSlug(alias) || /^\d+$/.test(alias)) throw new PageError(`Invalid alias "${alias}": lowercase letters, digits and dashes, not only digits`)
  if (RESERVED.has(alias)) throw new PageError(`/${alias} is already a page of the site`)
}

export function setAlias(alias: string, target: { username: string; slug: string } | null, setBy: string, now = new Date()): void {
  checkAlias(alias)
  const aliases = readAliases()
  if (target === null) {
    delete aliases[alias]
  } else {
    if (!getPage(target.username, target.slug)) throw new PageError(`No page /members/${target.username}/${target.slug}`)
    aliases[alias] = { username: target.username, slug: target.slug, setBy, setAt: now.toISOString() }
  }
  writeAliases(aliases)
}

export function resolveAlias(alias: string): MemberPage | null {
  if (!isSlug(alias)) return null
  const target = readAliases()[alias]
  return target ? getPage(target.username, target.slug) : null
}

// ── access to members-only files from the sandbox ────────────────────────

/**
 * The sandboxed document has an opaque origin, so the session cookie does
 * not come with its requests for images or scripts. A members-only page's
 * files are served under a signed, expiring prefix instead:
 * /sandbox/t/<token>/<username>/<slug>/…, the token minted for a member
 * by the page that embeds it.
 */
const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret"

export function accessToken(username: string, slug: string, expiresAt: number): string {
  const exp = Math.floor(expiresAt / 1000).toString(36)
  const mac = createHmac("sha256", secret()).update(`member-page:${username}/${slug}:${exp}`).digest("base64url").slice(0, 32)
  return `${exp}.${mac}`
}

export function checkAccessToken(token: string, username: string, slug: string, now = Date.now()): boolean {
  const [exp, mac] = token.split(".")
  if (!exp || !mac) return false
  const expected = accessToken(username, slug, parseInt(exp, 36) * 1000).split(".")[1]
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b) && parseInt(exp, 36) * 1000 > now
}

/** The address of a page's index.html in the sandbox (its other files resolve beside it). */
export function sandboxBase(page: Pick<MemberPage, "username" | "slug" | "visibility">, now = Date.now()): string {
  const prefix = page.visibility === "public" ? "" : `t/${accessToken(page.username, page.slug, now + 12 * 3600_000)}/`
  return `/sandbox/${prefix}${page.username}/${page.slug}/index.html`
}

// ── the sandbox's rules ──────────────────────────────────────────────────

/** Public CDNs a page may load libraries, styles and fonts from. */
export const CDNS = ["https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://esm.sh", "https://cdn.plot.ly", "https://d3js.org"]
const FONTS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"]
/** Map tiles, for maps. */
const TILES = ["https://tile.openstreetmap.org", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com"]

/**
 * The Content-Security-Policy of a sandboxed page. `sandbox` without
 * allow-same-origin gives it an opaque origin; the source lists keep it to
 * its own folder (`origin`/sandbox/), the open data and the CDNs: no
 * /api, no other server. Navigation can't be restricted by CSP, but the
 * document holds nothing of the viewer's to leak.
 */
export function sandboxCsp(origin: string): string {
  const own = `${origin}/sandbox/`
  const open = `${origin}/opendata/`
  const lib = CDNS.join(" ")
  return [
    "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads",
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' blob: ${own} ${lib}`,
    `style-src 'unsafe-inline' ${own} ${lib} ${FONTS[0]}`,
    `font-src data: ${own} ${lib} ${FONTS[1]}`,
    `img-src data: blob: ${own} ${open} ${lib} ${TILES.join(" ")}`,
    `media-src data: blob: ${own}`,
    `connect-src ${own} ${open} ${lib}`,
    "worker-src blob:",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'self'",
  ].join("; ")
}

/**
 * What every page gets, first thing in its <head>: `window.chb`, the bridge
 * to the page that embeds it.
 *   await chb.me()            → { signedIn, username, displayName, member, steward }
 *   await chb.fetch("/data/2026/09/transactions.json")  → the text (GET, /data and /opendata only)
 *   await chb.json(path)      → the same, parsed
 *   await chb.discord.send({ to: "author" | "channel", content, fields })
 *   await chb.email.send({ subject, content, fields, replyTo })
 *                             → { sent: where }, once the viewer confirmed it (lib/member-page-actions.ts)
 * It also tells the parent its height, so the frame grows with the page.
 * The frame may load before the parent listens: the parent says hello when
 * it does, and the frame sends again what is still unanswered.
 */
export const BRIDGE_SCRIPT = `<script>(function(){var n=0,w={},last=0;function post(m){parent.postMessage(m,"*")}function ask(t,x){return new Promise(function(ok,ko){var id=++n,m={chb:t,id:id};for(var k in x)m[k]=x[k];w[id]={ok:ok,ko:ko,m:m};post(m);setTimeout(function(){if(w[id]){delete w[id];ko(new Error("chb: no answer"))}},t==="action"?600000:20000)})}function size(){var h=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0));if(h!==last){last=h;post({chb:"height",value:h})}}addEventListener("message",function(e){if(e.source!==parent)return;var d=e.data||{};if(d.chbHello){for(var k in w)post(w[k].m);last=0;size();return}var c=w[d.id];if(!c||!d.chbReply)return;delete w[d.id];d.error?c.ko(new Error(d.error)):c.ok(d.value)});function act(kind){return function(o){return ask("action",{kind:kind,data:o})}}window.chb={me:function(){return ask("me")},fetch:function(p){return ask("fetch",{path:p})},json:function(p){return ask("fetch",{path:p}).then(JSON.parse)},discord:{send:act("discord")},email:{send:act("email")}};addEventListener("load",size);if(window.ResizeObserver)new ResizeObserver(size).observe(document.documentElement);setInterval(size,1000)})();</script>`

/** The page's HTML with the bridge put first in <head> (or at the very start). */
export function withBridge(html: string): string {
  const head = html.match(/<head[^>]*>/i)
  if (head && head.index !== undefined) {
    const at = head.index + head[0].length
    return html.slice(0, at) + BRIDGE_SCRIPT + html.slice(at)
  }
  return BRIDGE_SCRIPT + html
}

export { bridgeAllows } from "./member-pages-bridge"
