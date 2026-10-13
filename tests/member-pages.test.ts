/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, test } from "@jest/globals"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "member-pages-"))
process.env.PAGES_DIR = dir
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mp = require("@/lib/member-pages") as typeof import("@/lib/member-pages")

const base = { username: "alice", discordId: "111111", slug: "budget-chart", title: "Budget chart", html: "<html><head><title>x</title></head><body>hi</body></html>" }

beforeEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
})

describe("savePage", () => {
  test("stores the page and its files; members-only by default", () => {
    const page = mp.savePage({ ...base, files: [{ path: "data.json", text: "[1,2]" }, { path: "./img/a.png", base64: Buffer.from([1, 2, 3]).toString("base64") }] })
    expect(page.visibility).toBe("members")
    expect(page.files.map((f) => f.path)).toEqual(["index.html", "data.json", "img/a.png"])
    const got = mp.getPage("alice", "budget-chart")!
    expect(fs.readFileSync(mp.pageFilePath(got, "img/a.png")!)).toEqual(Buffer.from([1, 2, 3]))
    expect(mp.pageFilePath(got, "../../etc/passwd")).toBeNull()
    expect(mp.pageFilePath(got, "missing.png")).toBeNull()
  })

  test("rejects path traversal, unknown types and oversize files", () => {
    expect(() => mp.savePage({ ...base, files: [{ path: "../x.js", text: "" }] })).toThrow(mp.PageError)
    expect(() => mp.savePage({ ...base, files: [{ path: "a/../../x.js", text: "" }] })).toThrow(mp.PageError)
    // A leading slash only means "from the page's folder".
    expect(mp.checkFilePath("/etc/x.js")).toBe("etc/x.js")
    expect(() => mp.checkFilePath("a//b.js")).toThrow(mp.PageError)
    expect(() => mp.savePage({ ...base, files: [{ path: "run.sh", text: "" }] })).toThrow(/not allowed/)
    expect(() => mp.savePage({ ...base, files: [{ path: "index.html", text: "" }] })).toThrow(/pass it as html/)
    expect(() => mp.savePage({ ...base, html: "x".repeat(mp.LIMITS.html + 1) })).toThrow(/limit/)
    expect(() => mp.savePage({ ...base, slug: "Not A Slug" })).toThrow(/Invalid slug/)
    expect(() => mp.savePage({ ...base, username: "../root" })).toThrow(/Invalid username/)
  })

  test("only its author (or a steward) replaces a page; replacing keeps the first date", () => {
    const first = mp.savePage({ ...base, now: new Date("2026-10-01T10:00:00Z"), files: [{ path: "old.csv", text: "a" }] })
    expect(() => mp.savePage({ ...base, discordId: "222222" })).toThrow(/someone else/)
    const again = mp.savePage({ ...base, title: "Budget v2", now: new Date("2026-10-02T10:00:00Z") })
    expect(again.publishedAt).toBe(first.publishedAt)
    expect(again.updatedAt).toBe("2026-10-02T10:00:00.000Z")
    // Replaced whole: the old file is gone.
    expect(fs.existsSync(path.join(dir, "alice", "budget-chart", "files", "old.csv"))).toBe(false)
    const bySteward = mp.savePage({ ...base, discordId: "222222", canOverride: true })
    expect(bySteward.discordId).toBe("111111")
  })

  test("listPages and deletePage, with the page's aliases", () => {
    mp.savePage(base)
    mp.savePage({ ...base, slug: "other", visibility: "public" })
    expect(mp.listPages("alice").map((p) => p.slug).sort()).toEqual(["budget-chart", "other"])
    mp.setAlias("budget", { username: "alice", slug: "budget-chart" }, "999")
    expect(mp.resolveAlias("budget")?.slug).toBe("budget-chart")
    expect(mp.deletePage("alice", "budget-chart")).toBe(true)
    expect(mp.resolveAlias("budget")).toBeNull()
    expect(mp.readAliases()).toEqual({})
  })
})

describe("aliases", () => {
  test("never take a page of the site, a year, or a missing page", () => {
    mp.savePage(base)
    expect(() => mp.setAlias("finance", { username: "alice", slug: "budget-chart" }, "1")).toThrow(/already a page/)
    expect(() => mp.setAlias("2027", { username: "alice", slug: "budget-chart" }, "1")).toThrow(/Invalid alias/)
    expect(() => mp.setAlias("nope", { username: "alice", slug: "missing" }, "1")).toThrow(/No page/)
  })

  test("RESERVED covers every top-level route of the app", () => {
    const app = path.join(process.cwd(), "src", "app")
    const routes = fs
      .readdirSync(app, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("(") && !d.name.startsWith("_"))
      .map((d) => d.name)
    expect(routes.filter((r) => !mp.RESERVED.has(r))).toEqual([])
  })
})

describe("access tokens for members-only pages", () => {
  test("valid for this page until they expire", () => {
    const now = Date.parse("2026-10-13T12:00:00Z")
    const token = mp.accessToken("alice", "budget-chart", now + 3600_000)
    expect(mp.checkAccessToken(token, "alice", "budget-chart", now)).toBe(true)
    expect(mp.checkAccessToken(token, "alice", "other", now)).toBe(false)
    expect(mp.checkAccessToken(token, "alice", "budget-chart", now + 2 * 3600_000)).toBe(false)
    expect(mp.checkAccessToken("x.y", "alice", "budget-chart", now)).toBe(false)
  })

  test("sandboxBase: plain for public pages, signed for members-only ones", () => {
    expect(mp.sandboxBase({ username: "alice", slug: "s", visibility: "public" })).toBe("/sandbox/alice/s/index.html")
    expect(mp.sandboxBase({ username: "alice", slug: "s", visibility: "members" })).toMatch(/^\/sandbox\/t\/[a-z0-9]+\.[\w-]+\/alice\/s\/index\.html$/)
  })
})

describe("the sandbox", () => {
  test("CSP: opaque origin, own folder and open data only, no API", () => {
    const csp = mp.sandboxCsp("https://commonshub.brussels")
    expect(csp).toMatch(/^sandbox allow-scripts /)
    expect(csp).not.toContain("allow-same-origin")
    expect(csp).not.toContain("allow-top-navigation")
    expect(csp).toContain("connect-src https://commonshub.brussels/sandbox/ https://commonshub.brussels/opendata/ ")
    expect(csp).not.toMatch(/connect-src[^;]*'self'/)
    expect(csp).not.toMatch(/https:\/\/commonshub\.brussels\/api/)
    expect(csp).toContain("form-action 'none'")
  })

  test("the bridge goes first in <head>", () => {
    const html = mp.withBridge("<!doctype html><html><head lang=en><title>t</title></head></html>")
    expect(html.indexOf("window.chb")).toBeGreaterThan(html.indexOf("<head lang=en>"))
    expect(html.indexOf("window.chb")).toBeLessThan(html.indexOf("<title>"))
    expect(mp.withBridge("<p>no head</p>").startsWith("<script>")).toBe(true)
  })

  test("the bridge reads /data and /opendata only", () => {
    expect(mp.bridgeAllows("/data/2026/09/members/transactions.json")).toBe(true)
    expect(mp.bridgeAllows("/opendata/latest/accounts-chart.json")).toBe(true)
    expect(mp.bridgeAllows("/api/auth/session")).toBe(false)
    expect(mp.bridgeAllows("/data/../api/auth/session")).toBe(false)
    expect(mp.bridgeAllows("//evil.example/data")).toBe(false)
    expect(mp.bridgeAllows("https://evil.example/data")).toBe(false)
    expect(mp.bridgeAllows("/database")).toBe(false)
  })
})
