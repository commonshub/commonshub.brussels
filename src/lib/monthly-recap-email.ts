/**
 * The recap email of a member's month, quarter or year (lib/monthly-recap.ts):
 * the same content as /<username>/<year>/<month|QN>, in email-safe HTML
 * (tables, inline styles) plus a plain-text part. Same look as the shift
 * confirmation (lib/shift-email.ts). Its footer links to the member's
 * notification settings: the sender passes the signed link (settingsLink).
 */

import { HUB } from "./shift-email"
import { SITE, lineText, periodName, periodPath, shortDate, tokens, type Recap } from "./monthly-recap"
import { settingsUrl } from "./notification-links"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const eventWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }).replace(",", "")

/** An absolute, resized photo URL the email can load. */
const photoUrl = (src: string, origin: string) => `${origin}/api/image-proxy?${new URLSearchParams({ url: src, size: "sm" })}`

export const recapUrl = (r: Pick<Recap, "member" | "period">, origin = SITE) => `${origin}/${encodeURIComponent(r.member.username)}/${periodPath(r.period)}`

const EVERY = { month: "once a month", quarter: "every three months", year: "once a year" }

export function recapSubject(r: Recap): string {
  return `Your ${periodName(r.period, r.period.kind !== "month")} at the Commons Hub`
}

/** `settingsLink`: the notification settings URL with its signed token (settingsUrl + signSettingsLink). */
export function buildRecapEmail(r: Recap, { origin = SITE, settingsLink = settingsUrl(origin) } = {}): { subject: string; html: string; text: string } {
  const subject = recapSubject(r)
  const month = periodName(r.period)
  const span = r.period.kind === "month" ? "month" : r.period.kind === "quarter" ? "three months" : "year"
  const online = recapUrl(r, origin)
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
          `<tr><td style="padding:6px 0;border-bottom:1px solid #f0e6e2;color:#5d625e;white-space:nowrap;width:64px;vertical-align:top">${esc(shortDate(l.at))}</td><td style="padding:6px 8px;border-bottom:1px solid #f0e6e2">${esc(lineText(l))}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f0e6e2;white-space:nowrap;font-weight:600;vertical-align:top">${esc(tokens(l.amount))}</td></tr>`,
      )
      .join("")}</table>`

  const photos = r.photos.slice(0, 12)
  const rows: string[] = []
  for (let i = 0; i < photos.length; i += 3) {
    const cells = photos.slice(i, i + 3).map(
      (p) =>
        `<td width="33%" style="padding:3px;vertical-align:top"><img src="${esc(photoUrl(p.src, origin))}" alt="${esc(p.text || `Shared by ${p.by}`)}" width="176" style="display:block;width:100%;height:auto;border-radius:8px;border:0"></td>`,
    )
    while (cells.length < 3) cells.push(`<td width="33%"></td>`)
    rows.push(`<tr>${cells.join("")}</tr>`)
  }

  const quiet = r.days === 0 && !r.received.length && !r.spent.length && !r.praise.length

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF4F2;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #eaded9">
<tr><td style="padding:28px 28px 8px" align="left">
  <a href="${SITE}"><img src="${HUB.logoUrl}" alt="${HUB.name}" width="120" style="display:block;width:120px;height:auto;border:0"></a>
</td></tr>
<tr><td style="padding:8px 28px 32px">
  <h1 style="font-size:22px;line-height:1.3;margin:12px 0 8px">Hi ${esc(first)}, here's your ${esc(month)}</h1>
  <p style="margin:0 0 18px">${quiet ? `We didn't see you at the hub this ${span}. We miss you! Here's what the community has been up to.` : `Thank you for being part of the Commons Hub. Here's what your ${span} looked like.`}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>
    ${stat(String(r.days), r.days === 1 ? "day at the hub" : "days at the hub")}
    ${stat(`+${r.receivedTotal}`, "tokens received")}
    ${stat(`−${r.spentTotal}`, "tokens spent")}
  </tr></table>
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
  ${h2("See you at the hub")}
  <p style="margin:0 0 12px">Shifts are how we keep the hub open and welcoming, and they earn tokens.</p>
  <p style="margin:0 0 8px">${button(`${origin}/shifts`, "Sign up for a shift", true)}</p>
${
  r.events.length
    ? `  <p style="margin:20px 0 8px">Or come to one of the upcoming events:</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${r.events
    .map(
      (e) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f0e6e2;color:#b83500;white-space:nowrap;width:130px;vertical-align:top">${esc(eventWhen(e.start))}</td><td style="padding:6px 0 6px 8px;border-bottom:1px solid #f0e6e2"><a href="${esc(e.url)}" style="color:#001309;font-weight:600;text-decoration:none">${esc(e.name)}</a></td></tr>`,
    )
    .join("")}</table>
  <p style="margin:12px 0 0">${button(`${origin}/#events`, "All events")}</p>`
    : ""
}
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">
  <a href="${esc(online)}" style="color:#5d625e">See this online</a> · <a href="${esc(settingsLink)}" style="color:#5d625e">Notification settings</a><br>
  You receive this ${EVERY[r.period.kind]} because you're a member of the Commons Hub. You can choose monthly, quarterly or yearly recaps, or none, in your <a href="${esc(settingsLink)}" style="color:#5d625e">notification settings</a>.<br>
  ${HUB.name} · ${esc(HUB.address)}
</td></tr>
</table></td></tr></table>
</body></html>`

  const textLines = (ls: Recap["received"]) => ls.map((l) => `- ${shortDate(l.at)}: ${lineText(l)} (${tokens(l.amount)})`)
  const text = [
    `Hi ${first}, here's your ${month}`,
    "",
    `${r.days} ${r.days === 1 ? "day" : "days"} at the hub · +${r.receivedTotal} tokens received · −${r.spentTotal} tokens spent`,
    ...(r.received.length ? ["", "TOKENS YOU RECEIVED", ...textLines(r.received)] : []),
    ...(r.spent.length ? ["", "TOKENS YOU SPENT", ...textLines(r.spent)] : []),
    ...(r.praise.length ? ["", "THANK-YOUS FOR YOU", ...r.praise.map((p) => `"${p.text}" (${p.from.name}, ${shortDate(p.at)})`)] : []),
    "",
    "SEE YOU AT THE HUB",
    `Sign up for a shift: ${origin}/shifts`,
    ...r.events.map((e) => `- ${eventWhen(e.start)}: ${e.name} ${e.url}`),
    "",
    `See this online: ${online}`,
    `Notification settings (monthly, quarterly, yearly or none): ${settingsLink}`,
  ].join("\n")

  return { subject, html, text }
}
