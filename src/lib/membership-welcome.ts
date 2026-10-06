/**
 * The email a new member gets once, when their first membership payment
 * lands (card or bank transfer). It says thank you, lists what the
 * membership gives, and points to the few things that make someone part of
 * the community: Discord, the Monday Heartbeat, the handbook, a first shift.
 *
 * chb sends it (it holds the members' emails; the website never does), from
 * docs/emails/membership-welcome.*, generated from buildWelcomeEmail
 * (bun scripts/export-reminder-template.ts).
 */

import { SHIFTS_CHANNEL_URL } from "./shift-email"

const HUB = {
  name: "Commons Hub Brussels",
  address: "Rue de la Madeleine 51, 1000 Brussels",
  website: "https://commonshub.brussels",
  logoUrl: "https://commonshub.brussels/brandkit/commonshub-logo-sticker.png",
  discord: "https://discord.commonshub.brussels",
  events: "https://commonshub.brussels/events",
  handbook: "https://commonshub.brussels/handbook",
  from: "Commons Hub Brussels <hello@commonshub.brussels>",
  replyTo: "hello@commonshub.brussels",
}

export interface MembershipWelcome {
  name: string
  email: string
  organisation?: boolean
}

/** What the membership gives, as on /membership. */
export const WELCOME_PERKS = {
  individual: [
    "Feel at home in the hub: access to the door at all times, and help yourself in the kitchen.",
    "30% off all events and room rentals.",
    "Cowork at the hub one day a month.",
    "Tokens for the time you give, which you can spend on the space, and a voice in how the hub is run.",
    "All Discord channels, and the Heartbeat meeting every Monday, 13:00–14:00.",
  ],
  organisation: [
    "Your logo on the website as a partner organisation.",
    "Membership for two people, who can both open the door.",
    "30% off all bookings and events.",
    "Make the hub the place where your community meets, and earn tokens to rent the space for your meetups.",
    "Make proposals and join the conversations that shape the hub.",
  ],
}

const STEPS = [
  { title: "Join us on Discord", text: "That's where the community talks, plans and asks for help.", href: HUB.discord, label: "discord.commonshub.brussels" },
  { title: "Come to the Heartbeat", text: "Every Monday, 13:00–14:00 at the hub: what's happening, what's needed, who does what.", href: HUB.events, label: "See what's on" },
  { title: "Read the handbook", text: "How the hub works: the door, the kitchen, the rooms, the tokens.", href: HUB.handbook, label: "Commons Hub Handbook" },
  { title: "Take a first shift", text: "Welcome people at an event and earn tokens. It's the quickest way to meet everyone. Type /shifts in #shifts on Discord to pick one.", href: SHIFTS_CHANNEL_URL, label: "#shifts on Discord" },
]

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function buildWelcomeEmail(d: MembershipWelcome): { subject: string; html: string; text: string } {
  const subject = d.organisation ? "Welcome to the Commons Hub" : `Welcome to the Commons Hub, ${d.name}`
  const opening = d.organisation
    ? `Thank you for making ${d.name} a member of the Commons Hub. Memberships are how we pay the rent and keep this common space open for everyone. We're glad you're with us.`
    : "Thank you for becoming a member of the Commons Hub. Memberships are how we pay the rent and keep this common space open for everyone. We're glad you're with us."
  const perks = d.organisation ? WELCOME_PERKS.organisation : WELCOME_PERKS.individual
  const questions = "Questions? Ask Elinor, our community bot, on Discord, or just reply to this email."

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF4F2;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #eaded9">
<tr><td style="padding:28px 28px 8px"><a href="${HUB.website}"><img src="${HUB.logoUrl}" alt="${HUB.name}" width="120" style="display:block;width:120px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:8px 28px 32px">
  <h1 style="font-size:22px;line-height:1.3;margin:12px 0 8px">Welcome, ${esc(d.name)}!</h1>
  <p style="margin:0 0 12px">${esc(opening)}</p>

  <h2 style="font-size:17px;margin:24px 0 6px">Your first steps</h2>
  ${STEPS.map(
    (s, i) => `<p style="margin:0 0 12px"><strong>${i + 1}. ${esc(s.title)}.</strong> ${esc(s.text)}<br><a href="${esc(s.href)}" style="color:#b83500">${esc(s.label)}</a></p>`,
  ).join("\n  ")}

  <h2 style="font-size:17px;margin:24px 0 6px">What your membership gives you</h2>
  <ul style="margin:0;padding-left:20px">
    ${perks.map((p) => `<li style="margin:0 0 6px">${esc(p)}</li>`).join("\n    ")}
  </ul>

  <p style="margin:28px 0 0;font-size:15px">${esc(questions)}</p>
  <p style="margin:16px 0 0">See you at the hub!</p>
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">${HUB.name} · ${esc(HUB.address)} · <a href="${HUB.website}" style="color:#5d625e">commonshub.brussels</a></td></tr>
</table></td></tr></table>
</body></html>`

  const text = [
    `Welcome, ${d.name}!`,
    "",
    opening,
    "",
    "YOUR FIRST STEPS",
    ...STEPS.flatMap((s, i) => ["", `${i + 1}. ${s.title}. ${s.text}`, s.href]),
    "",
    "WHAT YOUR MEMBERSHIP GIVES YOU",
    ...perks.map((p) => `- ${p}`),
    "",
    questions,
    "",
    "See you at the hub!",
    "",
    `${HUB.name} · ${HUB.address} · ${HUB.website}`,
  ].join("\n")
  return { subject, html, text }
}

export async function sendWelcome(d: MembershipWelcome): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY is not set")
  const { subject, html, text } = buildWelcomeEmail(d)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: HUB.from, to: [d.email], reply_to: [HUB.replyTo], subject, html, text }),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string }
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body).slice(0, 200)}`)
  return { id: body.id || "" }
}
