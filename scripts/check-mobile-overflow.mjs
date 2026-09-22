/**
 * No page may scroll sideways on a phone.
 *
 * Loads each route at 390x844 in a headless Chromium and compares
 * document.scrollWidth with the viewport, naming the elements that stick out.
 * This is how the day page's overflow was found: the grid container was 390
 * wide and its item 663, because a grid item's automatic minimum is its
 * content's min-content width (min-w-0 fixes that), while long URLs in a
 * description are single unbreakable words (shortenUrls fixes that).
 *
 *   node scripts/check-mobile-overflow.mjs https://commonshub.brussels / /today /membership
 *
 * Exits non-zero if any route overflows. Member-only markup needs a session,
 * so point it at a local server when you need to check that.
 */
import { chromium } from "playwright"
const base = process.argv[2]
const routes = process.argv.slice(3)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
let failed = 0
for (const route of routes) {
  try {
    const res = await page.goto(base + route, { waitUntil: "networkidle", timeout: 45000 })
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const worst = []
      for (const el of document.querySelectorAll("body *")) {
        const b = el.getBoundingClientRect()
        if (b.width && b.right > vw + 0.5) worst.push({ t: el.tagName.toLowerCase(), c: el.className.toString().slice(0, 55), w: Math.round(b.width), txt: (el.textContent || "").trim().slice(0, 30) })
      }
      const deepest = worst.filter((_, i) => i >= worst.length - 3)
      return { vw, sw: document.documentElement.scrollWidth, n: worst.length, deepest }
    })
    if (r.sw > r.vw) failed++
    const flag = r.sw > r.vw ? "OVERFLOW" : "ok      "
    console.log(`${flag} ${String(res?.status() ?? "?").padEnd(3)} ${route.padEnd(28)} scrollWidth=${r.sw}` + (r.sw > r.vw ? ` offenders=${r.n} ${JSON.stringify(r.deepest)}` : ""))
  } catch (e) {
    failed++
    console.log(`ERROR      ${route.padEnd(28)} ${String(e).split("\n")[0].slice(0, 80)}`)
  }
}
await browser.close()
process.exit(failed > 0 ? 1 : 0)
