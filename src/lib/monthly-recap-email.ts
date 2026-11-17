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
export function buildRecapEmail(r: Recap, { origin = SITE, settingsLink = settingsUrl(origin), linkDiscord }: { origin?: string; settingsLink?: string; linkDiscord?: string } = {}): { subject: string; html: string; text: string } {
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
  const lines = (ls: Recap["received"]) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${ls
      .map(
        (l) =>
          `<tr><td style="padding:8px 8px 8px 0;border-bottom:1px solid #f0e6e2"><div style="font-size:13px;color:#5d625e">${esc(shortDate(l.at))}</div><div>${esc(lineText(l))}</div></td><td align="right" style="padding:8px 0;border-bottom:1px solid #f0e6e2;white-space:nowrap;font-weight:600;vertical-align:bottom">${esc(tokens(l.amount))}</td></tr>`,
      )
      .join("")}</table>`

  // Columns of one portrait or two stacked landscapes, cropped by the image proxy to shapes that line up.
  const img = (t: MosaicTile) =>
    `<img src="${esc(photoUrl(t.photo.src, origin, t.crop))}" alt="${esc(t.photo.text || `Shared by ${t.photo.by}`)}" width="175" style="display:block;width:100%;height:auto;border-radius:8px;border:0">`
  const rows = mosaicRows(r.photos.slice(0, 12)).map((cols) => {
    const cells = cols.map((tiles) => `<td width="33%" style="padding:3px;vertical-align:top">${tiles.map(img).join(`<div style="height:6px;line-height:6px;font-size:0">&nbsp;</div>`)}</td>`)
    while (cells.length < 3) cells.push(`<td width="33%"></td>`)
    return `<tr>${cells.join("")}</tr>`
  })

  const quiet = r.days === 0 && !r.received.length && !r.spent.length && !r.praise.length

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF4F2;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #eaded9">
<tr><td style="padding:28px 28px 8px" align="left">
  <a href="${SITE}" style="text-decoration:none;color:#001309"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle"><img src="${ICON}" alt="" width="36" height="36" style="display:block;width:36px;height:36px;border:0;border-radius:18px"></td><td style="vertical-align:middle;padding-left:10px;font-size:17px;font-weight:800;color:#001309">${HUB.name}</td></tr></table></a>
</td></tr>
<tr><td style="padding:8px 28px 32px">
  <h1 style="font-size:22px;line-height:1.3;margin:12px 0 8px">Hi ${esc(first)}, here's your ${esc(month)}</h1>
${
  known
    ? `  <p style="margin:0 0 18px">${quiet ? `We didn't see you at the hub this ${span}. We miss you! Here's what the community has been up to.` : `Thank you for being part of the Commons Hub. Here's what your ${span} looked like.`}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>
    ${stat(String(r.days), r.days === 1 ? "day at the hub" : "days at the hub")}
    ${stat(`+${r.receivedTotal}`, "tokens received")}
    ${stat(`−${r.spentTotal}`, "tokens spent")}
  </tr></table>`
    : `  <p style="margin:0 0 18px">Thank you for being a member of the Commons Hub. Here's what the community has been up to this ${span}.</p>
${
  linkDiscord
    ? `  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2;border-radius:10px"><tr><td style="padding:16px">
    <div style="font-weight:700;margin:0 0 4px">See your own ${span} here</div>
    <div style="font-size:15px;margin:0 0 12px">Link your Discord account to your membership: next time this email shows the days you came, the tokens you earned and spent, and the thank-yous you got.</div>
    ${button(linkDiscord, "Link my Discord account", true)}
  </td></tr></table>`
    : ""
}`
}
${r.received.length ? `${h2("Tokens you received")}${lines(r.received)}` : ""}
${r.spent.length ? `${h2("Tokens you spent")}${lines(r.spent)}` : ""}
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
${
  rows.length
    ? `${h2("Shared in #contributions")}
  <p style="margin:0 0 8px;font-size:15px;color:#5d625e">What members did for the hub this ${span}.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`
    : ""
}
${communityHtml(r, span, h2)}
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
<tr><td style="padding:24px 28px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">
  ${online ? `<a href="${esc(online)}" style="color:#5d625e">See this online</a> · ` : ""}<a href="${esc(settingsLink)}" style="color:#5d625e">Notification settings</a><br>
  You receive this ${EVERY[r.period.kind]} because you're a member of the Commons Hub. You can choose monthly, quarterly or yearly recaps, or none, in your <a href="${esc(settingsLink)}" style="color:#5d625e">notification settings</a>.<br>
  ${HUB.name} · ${esc(HUB.address)}
</td></tr>
</table></td></tr></table>
</body></html>`

  const textLines = (ls: Recap["received"]) => ls.map((l) => `- ${shortDate(l.at)}: ${lineText(l)} (${tokens(l.amount)})`)
  const text = [
    `Hi ${first}, here's your ${month}`,
    "",
    ...(known
      ? [`${r.days} ${r.days === 1 ? "day" : "days"} at the hub · +${r.receivedTotal} tokens received · −${r.spentTotal} tokens spent`]
      : [`Thank you for being a member of the Commons Hub. Here's what the community has been up to this ${span}.`, ...(linkDiscord ? ["", `Link your Discord account to see your own ${span} next time: ${linkDiscord}`] : [])]),
    ...(r.received.length ? ["", "TOKENS YOU RECEIVED", ...textLines(r.received)] : []),
    ...(r.spent.length ? ["", "TOKENS YOU SPENT", ...textLines(r.spent)] : []),
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
  ${c.care && c.care.people ? `<p style="margin:14px 0 0"><strong>${c.care.people} ${c.care.people === 1 ? "person" : "people"}</strong> gave <strong>${c.care.hours} ${c.care.hours === 1 ? "hour" : "hours"}</strong> of care shifts to keep the space open and welcoming. Thank you!</p>` : ""}`
}

function communityText(r: Recap, span: string): string[] {
  const c = r.community
  if (!c) return []
  return [
    "",
    `THE HUB THIS ${span.toUpperCase()}`,
    `${money(c.income)} came in. Keeping the hub open costs about ${money(c.costs)}${c.mainCosts.length ? ` (biggest: ${c.mainCosts.map((m) => `${m.label.toLowerCase()} ${money(m.monthly)}`).join(", ")} a month)` : ""}.`,
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
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#FBF4F2;border-radius:10px"><tr><td style="padding:14px 16px"><div style="font-size:13px;color:#b83500">${esc(dayDate(e.start))}</div><div style="font-weight:700;font-size:16px">${esc(e.name)}</div>${e.tagline ? `<div style="font-size:15px;color:#5d625e;margin:2px 0 0">${esc(e.tagline)}</div>` : ""}<div style="margin:10px 0 0">${button(e.url, "Find out more")}</div></td></tr></table>`,
    )
    .join("\n  ")}`
}
