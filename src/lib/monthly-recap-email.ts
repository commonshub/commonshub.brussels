/**
 * The recap email of a member's month, quarter or year (lib/monthly-recap.ts):
 * the same content as /<username>/<year>/<month|QN>, in email-safe HTML
 * (tables, inline styles) plus a plain-text part. Same look as the shift
 * confirmation (lib/shift-email.ts). Its footer links to the member's
 * notification settings: the sender passes the signed link (settingsLink).
 *
 * Every recap also carries what the community did: the next featured events,
 * the money in against what the hub costs, and the care shifts. A member chb
 * doesn't know on Discord (communityOnlyRecap: no member.id) gets only that,
 * with a button to link their Discord account (linkDiscord).
 *
 * Phones first: dates sit on their own line above what they're about, and
 * the header is the round icon plus the name as text, which email apps
 * recolour in dark mode (the wordmark image is dark text on transparent:
 * unreadable on a black background).
 */

import { HUB } from "./shift-email"
import { SITE, lineText, mosaicRows, periodName, periodPath, shortDate, tokens, type MosaicTile, type Recap } from "./monthly-recap"
import { settingsUrl } from "./notification-links"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const eventWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }).replace(",", "")

/** An absolute, resized photo URL the email can load. */
const photoUrl = (src: string, origin: string, crop?: MosaicTile["crop"]) => `${origin}/api/image-proxy?${new URLSearchParams({ url: src, size: "sm", ...(crop ? { crop } : {}) })}`

export const recapUrl = (r: Pick<Recap, "member" | "period">, origin = SITE) => `${origin}/${encodeURIComponent(r.member.username)}/${periodPath(r.period)}`

const EVERY = { month: "once a month", quarter: "every three months", year: "once a year" }
const ICON = `${SITE}/brandkit/commonshub-favicon.png`
const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
const dayDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Brussels" })

export function recapSubject(r: Recap): string {
  return `Your ${periodName(r.period, r.period.kind !== "month")} at the Commons Hub`
}

/** `settingsLink`: the notification settings URL with its signed token (settingsUrl + signSettingsLink). */
/**
 * `viewToken`: the member's signed settings token; the mosaic's photos link to the month's photo
 * carousel with it, so the messages show without logging in.
 */
export function buildRecapEmail(r: Recap, { origin = SITE, settingsLink = settingsUrl(origin), linkDiscord, viewToken }: { origin?: string; settingsLink?: string; linkDiscord?: string; viewToken?: string } = {}): { subject: string; html: string; text: string } {
  const subject = recapSubject(r)
  const known = !!r.member.id
  const month = periodName(r.period)
  const span = r.period.kind === "month" ? "month" : r.period.kind === "quarter" ? "three months" : "year"
  const online = known ? recapUrl(r, origin) : null
  const first = r.member.name.split(/\s+/)[0]

  const button = (href: string, label: string, primary = false) =>
    `<a href="${esc(href)}" style="display:inline-block;background:${primary ? "#FF4C02" : "#ffffff"};color:${primary ? "#ffffff" : "#b83500"};border:2px solid #FF4C02;text-decoration:none;font-weight:600;padding:9px 18px;border-radius:8px">${esc(label)}</a>`
  const h2 = (t: string) => `<h2 style="font-size:17px;margin:28px 0 8px">${t}</h2>`
  const stat = (n: string, label: string) =>
    `<td align="center" style="padding:14px 6px;background:#FBF4F2;border-radius:10px;width:33%"><div style="font-size:26px;font-weight:800;color:#b83500;line-height:1.1">${esc(n)}</div><div style="font-size:13px;color:#5d625e">${esc(label)}</div></td>`

  // Columns of one portrait or two stacked landscapes, cropped by the image proxy to shapes that line up.
  const img = (t: MosaicTile) => {
    const tag = `<img src="${esc(photoUrl(t.photo.src, origin, t.crop))}" alt="${esc(t.photo.text || `Shared by ${t.photo.by}`)}" width="175" style="display:block;width:100%;height:auto;border-radius:8px;border:0">`
    const href = photoPageUrl(t.photo.src, origin, viewToken)
    return href ? `<a href="${esc(href)}">${tag}</a>` : tag
  }
  // One list, latest last: tokens in and out, and the euros they paid (or got back).
  const txs = transactions(r)
  const txRows = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${txs
    .map(
      (t) =>
        `<tr><td style="padding:8px 0 0;font-size:13px;color:#5d625e">${esc(shortDate(t.at))}</td><td align="right" style="padding:8px 0 0;white-space:nowrap;font-weight:700;color:${t.amount > 0 ? "#2f7d4f" : "#001309"}">${esc(t.label)}</td></tr><tr><td colspan="2" style="padding:0 0 8px;border-bottom:1px solid #f0e6e2">${esc(t.description)}</td></tr>`,
    )
    .join("")}</table>`
  const rows = mosaicRows(r.photos.slice(0, 12)).map((cols) => {
    const cells = cols.map((tiles) => `<td width="33%" style="padding:3px;vertical-align:top">${tiles.map(img).join(`<div style="height:6px;line-height:6px;font-size:0">&nbsp;</div>`)}</td>`)
    while (cells.length < 3) cells.push(`<td width="33%"></td>`)
    return `<tr>${cells.join("")}</tr>`
  })

  const quiet = r.days === 0 && !r.received.length && !r.spent.length && !r.praise.length

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff">
<tr><td style="padding:20px 16px 8px" align="left">
  <a href="${SITE}" style="text-decoration:none;color:#001309"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><img src="${ICON}" alt="" width="36" height="36" style="display:block;width:36px;height:36px;border:0;border-radius:18px"></td><td style="vertical-align:middle;padding-left:10px;font-size:17px;font-weight:800;color:#001309">${HUB.name}</td></tr></table></a>
</td></tr>
<tr><td style="padding:8px 16px 28px">
  <h1 style="font-size:22px;line-height:1.3;margin:12px 0 8px">Hi ${esc(first)}, here's your ${esc(month)}</h1>
${
  known
    ? `  <p style="margin:0 0 18px">${quiet ? `We didn't see you at the hub this ${span}. We miss you! Here's what the community has been up to.` : `Thank you for being part of the Commons Hub. Here's what your ${span} looked like.`}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>
    ${stat(String(r.days), r.days === 1 ? "day at the hub" : "days at the hub")}
    ${stat(`+${r.receivedTotal}`, "tokens received")}
    ${stat(String(Math.abs(r.spentTotal) || 0), "tokens spent")}
  </tr></table>`
    : `  <p style="margin:0 0 18px">Thank you for being a member of the Commons Hub. Here's what the community has been up to this ${span}.</p>
${
  linkDiscord
    ? `  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2;border-radius:10px"><tr><td style="padding:16px">
    <div style="font-weight:700;margin:0 0 4px">See your own ${span} here</div>
    <div style="font-size:15px;margin:0 0 12px">Link your Discord account to your membership: next time this email shows the days you came, the tokens you earned and spent, and the thank-yous you got.</div>
    <div style="text-align:center;margin:4px 0 0"><a href="${esc(linkDiscord)}" style="display:inline-block;background:#5865F2;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 20px;border-radius:8px"><img src="${SITE}/brandkit/discord-white.png" alt="" width="20" height="20" style="display:inline-block;width:20px;height:20px;border:0;vertical-align:-4px;margin-right:8px">Link my Discord account</a></div>
  </td></tr></table>`
    : ""
}`
}
${txs.length ? `${h2("Transactions")}${txRows}` : ""}
${
  r.praise.length
    ? `${h2(`💝 ${r.praise.length === 1 ? "A thank-you" : `${r.praise.length} thank-yous`} for you`)}
  ${r.praise
    .map(
      (p) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#FBF4F2;border-radius:10px"><tr><td style="padding:12px 16px;font-size:15px"><div style="margin:0 0 4px">“${esc(p.text)}”</div><div style="font-size:13px;color:#5d625e">${esc(p.from.name)} · ${esc(shortDate(p.at))}</div></td></tr></table>`,
    )
    .join("\n  ")}`
    : ""
}
${communityHtml(r, span, h2)}
${
  rows.length
    ? `${h2("Shared in #contributions")}
  <p style="margin:0 0 8px;font-size:15px;color:#5d625e">What members did for the hub this ${span}, shared in #contributions.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`
    : ""
}
${featuredHtml(r, h2, button)}
  ${h2("See you at the hub")}
  <p style="margin:0 0 12px">Shifts are how we keep the hub open and welcoming, and they earn tokens.</p>
  <p style="margin:0 0 8px">${button(`${origin}/shifts`, "Sign up for a shift", true)}</p>
${
  r.events.length
    ? `  <p style="margin:20px 0 8px">Or come to one of the upcoming events:</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${r.events
    .map(
      (e) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f0e6e2"><div style="font-size:13px;color:#b83500">${esc(eventWhen(e.start))}</div><a href="${esc(e.url)}" style="color:#001309;font-weight:600;text-decoration:none">${esc(e.name)}</a></td></tr>`,
    )
    .join("")}</table>
  <p style="margin:12px 0 0">${button(`${origin}/#events`, "All events")}</p>`
    : ""
}
</td></tr>
<tr><td style="padding:20px 16px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">
  ${online ? `<a href="${esc(online)}" style="color:#5d625e">See this online</a> · ` : ""}<a href="${esc(settingsLink)}" style="color:#5d625e">Notification settings</a><br>
  You receive this ${EVERY[r.period.kind]} because you're a member of the Commons Hub. You can choose monthly, quarterly or yearly recaps, or none, in your <a href="${esc(settingsLink)}" style="color:#5d625e">notification settings</a>.<br>
  ${HUB.name} · ${esc(HUB.address)}
</td></tr>
</table></td></tr></table>
</body></html>`

  const text = [
    `Hi ${first}, here's your ${month}`,
    "",
    ...(known
      ? [`${r.days} ${r.days === 1 ? "day" : "days"} at the hub · +${r.receivedTotal} tokens received · ${Math.abs(r.spentTotal) || 0} tokens spent`]
      : [`Thank you for being a member of the Commons Hub. Here's what the community has been up to this ${span}.`, ...(linkDiscord ? ["", `Link your Discord account to see your own ${span} next time: ${linkDiscord}`] : [])]),
    ...(txs.length ? ["", "TRANSACTIONS", ...txs.map((t) => `- ${shortDate(t.at)} ${t.label}: ${t.description}`)] : []),
    ...(r.praise.length ? ["", "THANK-YOUS FOR YOU", ...r.praise.map((p) => `"${p.text}" (${p.from.name}, ${shortDate(p.at)})`)] : []),
    ...communityText(r, span),
    ...(r.featured?.length ? ["", "COMING UP", ...r.featured.map((e) => `- ${dayDate(e.start)}: ${e.name}${e.tagline ? `, ${e.tagline}` : ""} ${e.url}`)] : []),
    "",
    "SEE YOU AT THE HUB",
    `Sign up for a shift: ${origin}/shifts`,
    ...r.events.map((e) => `- ${eventWhen(e.start)}: ${e.name} ${e.url}`),
    "",
    ...(online ? [`See this online: ${online}`] : []),
    `Notification settings (monthly, quarterly, yearly or none): ${settingsLink}`,
  ].join("\n")

  return { subject, html, text }
}

/** The money in against what the hub costs, and the care shifts. */
function communityHtml(r: Recap, span: string, h2: (t: string) => string): string {
  const c = r.community
  if (!c) return ""
  const costs = c.mainCosts.map((m) => `${m.label.toLowerCase()} ${money(m.monthly)}`).join(", ")
  const covered = c.costs > 0 ? Math.round((c.income / c.costs) * 100) : null
  const bar = covered === null ? "" : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;background:#f0e6e2;border-radius:6px"><tr><td style="width:${Math.min(100, covered)}%;background:${covered >= 100 ? "#2f7d4f" : "#FF4C02"};height:10px;border-radius:6px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table><div style="font-size:13px;color:#5d625e">${covered}% of our fixed costs covered</div>`
  return `${h2("The hub this " + span)}
  <p style="margin:0 0 4px"><strong>${money(c.income)}</strong> came in this ${span}. Keeping the hub open costs about <strong>${money(c.costs)}</strong>${c.months > 1 ? ` (${money(c.costs / c.months)} a month)` : ""}${costs ? `: ${esc(costs)} a month are the biggest costs` : ""}.</p>
  ${bar}
${contributionHtml(r)}
  ${c.care && c.care.people ? `<p style="margin:14px 0 0"><strong>${c.care.people} ${c.care.people === 1 ? "person" : "people"}</strong> gave <strong>${c.care.hours} ${c.care.hours === 1 ? "hour" : "hours"}</strong> of care shifts to keep the space open and welcoming. Thank you!</p>` : ""}`
}

function communityText(r: Recap, span: string): string[] {
  const c = r.community
  if (!c) return []
  return [
    "",
    `THE HUB THIS ${span.toUpperCase()}`,
    `${money(c.income)} came in. Keeping the hub open costs about ${money(c.costs)}${c.mainCosts.length ? ` (biggest: ${c.mainCosts.map((m) => `${m.label.toLowerCase()} ${money(m.monthly)}`).join(", ")} a month)` : ""}.`,
    ...(r.contribution ? [`My personal contribution: ${money(r.contribution.personal)} (donate: ${SITE}/donate)`, ...(r.contribution.org ? [`${r.contribution.org.name}'s contribution: ${money(r.contribution.org.amount)}`] : [])] : []),
    ...(c.care && c.care.people ? [`${c.care.people} people gave ${c.care.hours} hours of care shifts. Thank you!`] : []),
  ]
}

/** The events we host, coming up, with their own page. */
function featuredHtml(r: Recap, h2: (t: string) => string, button: (href: string, label: string, primary?: boolean) => string): string {
  if (!r.featured?.length) return ""
  return `${h2("Coming up at the hub")}
  ${r.featured
    .map(
      (e) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#FBF4F2;border-radius:10px">${e.cover ? `<tr><td><a href="${esc(e.url)}"><img src="${esc(e.cover)}" alt="" width="544" style="display:block;width:100%;height:auto;border:0;border-radius:10px 10px 0 0"></a></td></tr>` : ""}<tr><td style="padding:14px 16px"><div style="font-size:13px;color:#b83500">${esc(dayDate(e.start))}</div><div style="font-weight:700;font-size:16px">${esc(e.name)}</div>${e.tagline ? `<div style="font-size:15px;color:#5d625e;margin:2px 0 0">${esc(e.tagline)}</div>` : ""}<div style="margin:10px 0 0">${button(e.url, "Find out more")}</div></td></tr></table>`,
    )
    .join("\n  ")}`
}

/** Under the share covered: what the member (and their organisation) paid in over the period, and a way to give more. */
function contributionHtml(r: Recap): string {
  const k = r.contribution
  if (!k) return ""
  const row = (label: string, amount: number, extra = "") =>
    `<tr><td style="padding:6px 0;font-size:15px">${esc(label)}</td><td align="right" style="padding:6px 0;font-size:15px;font-weight:700;white-space:nowrap">${money(amount)}</td>${extra}</tr>`
  const donate = `<td align="right" width="92" style="padding:6px 0 6px 10px;width:92px;white-space:nowrap"><a href="${SITE}/donate" style="display:inline-block;background:#FF4C02;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:6px 12px;border-radius:8px">Donate</a></td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;border-top:1px solid #f0e6e2">${row("My personal contribution", k.personal, donate)}${k.org ? row(`${k.org.name}'s contribution`, k.org.amount, `<td width="92" style="width:92px"></td>`) : ""}</table>`
}

/** "+1 token", "−3 tokens", "−€50", "+€12.50". */
function signed(amount: number, unit: "token" | "eur"): string {
  const sign = amount > 0 ? "+" : "−"
  const n = Math.abs(amount)
  if (unit === "eur") return `${sign}${new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)}`
  return `${sign}${tokens(n)}`
}

/** Tokens received and spent, and euros paid or refunded, by date. */
export function transactions(r: Pick<Recap, "received" | "spent" | "euros">): Array<{ at: number; amount: number; label: string; description: string }> {
  return [
    ...r.received.map((l) => ({ at: l.at, amount: l.amount, label: signed(l.amount, "token"), description: lineText(l) })),
    ...r.spent.map((l) => ({ at: l.at, amount: -l.amount, label: signed(-l.amount, "token"), description: lineText(l) })),
    ...(r.euros ?? []).map((e) => ({ at: e.at, amount: e.amount, label: signed(e.amount, "eur"), description: e.description || (e.amount < 0 ? "Payment to the Commons Hub" : "Refund") })),
  ].sort((a, b) => a.at - b.at)
}

/** The photo in the month's carousel (/contributions/YYYY/MM/photos), from its dataset path; null for anything else. */
export function photoPageUrl(src: string, origin = SITE, token?: string): string | null {
  const m = /^\/data\/(\d{4})\/(\d{2})\/public\/images\/([\w-]+)\.\w+$/.exec(src)
  if (!m) return null
  return `${origin}/contributions/${m[1]}/${m[2]}/photos?image=${m[3]}${token ? `&t=${encodeURIComponent(token)}` : ""}`
}
