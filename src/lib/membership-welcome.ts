/**
 * The email a new member gets once, when their first membership payment
 * lands (card or bank transfer). It says thank you, lists what the
 * membership gives, and points to the few things that make someone part of
 * the community: Discord (with links that open the right channel in the
 * app), the door, the Monday Heartbeat (optional), the handbook, a shift.
 *
 * chb sends it (it holds the members' emails; the website never does), from
 * docs/emails/membership-welcome.*, generated from buildWelcomeEmail
 * (bun scripts/export-reminder-template.ts).
 */

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
  /** The welcome page where they log in with Discord and get the member role (the website's flow). */
  claimUrl?: string
}

/**
 * What the membership gives, as on /apply (membership-join-section). The
 * coworking is the Friday open coworking, a community activity: other days
 * are an extra service for members, charged separately (with VAT), never
 * part of the membership.
 */
export const WELCOME_PERKS = {
  individual: [
    "🗳️ Take part in decisions and help shape the Hub: make proposals, and earn tokens for the time you give.",
    "🌱 Help care for the space and our shared resources.",
    "🏷️ Lower prices when you book rooms or events.",
    "💻 The Friday open coworking for members, newcomers and prospective commoners, and our community activities.",
    "💬 The members' channels on Discord and, if you like, the weekly Heartbeat meeting (Mondays, 13:00–14:00).",
  ],
  organisation: [
    "🪧 Your logo on the website as a partner organisation.",
    "🔑 Membership for two people, who can both open the door.",
    "🏷️ Lower prices on bookings and events.",
    "🤝 Make the hub the place where your community meets, and earn tokens to rent the space for your meetups.",
    "🗳️ Make proposals and join the conversations that shape the hub.",
  ],
}

/** Coworking on other days: an extra service, not part of the membership. */
const COWORKING_NOTE = "Coworking on other days is an extra service for members, charged separately: 2 tokens a day, 1 token for half a day (type /buy on Discord)."

/** A channel on our Discord server: opens the Discord app there (on a phone), or Discord in the browser. */
const GUILD = "1280532848604086365"
const channel = (id: string) => `https://discord.com/channels/${GUILD}/${id}`
const CHANNELS = { door: channel("1306678821751230514"), heartbeat: channel("1443604524307583099"), shifts: channel("1443604838255427584") }
const DISCORD_DOWNLOAD = "https://discord.com/download"
const ELINOR = "https://elinor.commonshub.brussels"

type Step = { emoji: string; title: string; text: string; href: string; label: string }

/** The first steps; with a claimUrl, logging in with Discord on the site gives the member role. */
const steps = (d: MembershipWelcome): Step[] => [
  { emoji: "📲", title: "Get Discord", text: "Discord is where the community talks, plans and asks for help. Get the app for your phone or your computer (it's free).", href: DISCORD_DOWNLOAD, label: "Download Discord" },
  d.claimUrl
    ? { emoji: "🎟️", title: "Log in with Discord to get your member role", text: "Log in with your Discord account (create one if you don't have one yet): we'll add you to our server with the member role, which opens the members' channels and the door.", href: d.claimUrl, label: "Get my member role" }
    : { emoji: "🎟️", title: "Join us on Discord", text: "Join our server, then reply to this email with your Discord username: we'll give you the member role, which opens the members' channels and the door.", href: HUB.discord, label: "discord.commonshub.brussels" },
  { emoji: "🚪", title: "Open the door", text: "With the member role, go to the #door channel and type \"open\": the door at Rue de la Madeleine 51 buzzes open within a few seconds. Tip: add the #door channel to your favourites.", href: CHANNELS.door, label: "Open the #door channel" },
  { emoji: "💓", title: "Come to the Heartbeat, if you like", text: "Every Monday, 13:00–14:00 at the hub: what's happening, what's needed, who does what. It's optional, and a nice way to meet everyone.", href: CHANNELS.heartbeat, label: "Open the #heartbeat channel" },
  { emoji: "📖", title: "Read the handbook", text: "How the hub works: the door, the kitchen, the rooms, the tokens.", href: HUB.handbook, label: "Commons Hub Handbook" },
  { emoji: "🙌", title: "Take a first shift", text: "Welcome people at an event and earn tokens: the quickest way to meet everyone. Pick one on commonshub.brussels/shifts, or in the #shifts channel.", href: CHANNELS.shifts, label: "Open the #shifts channel" },
]

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function buildWelcomeEmail(d: MembershipWelcome): { subject: string; html: string; text: string } {
  const subject = `Welcome to the Commons Hub, ${d.name} 🎉`
  const opening = d.organisation
    ? `Thank you for making ${d.name} a member of the Commons Hub. Memberships are how we pay the rent and keep this common space open for everyone. We're glad you're with us.`
    : "Thank you for becoming a member of the Commons Hub. Memberships are how we pay the rent and keep this common space open for everyone. We're glad you're with us."
  const perks = d.organisation ? WELCOME_PERKS.organisation : WELCOME_PERKS.individual
  const questions = `Questions? Ask Elinor, our community bot, on Discord (${ELINOR}), or just reply to this email.`
  const questionsHtml = `Questions? Ask <a href="${ELINOR}" style="color:#b83500">Elinor</a>, our community bot, on Discord, or just reply to this email.`

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF4F2;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #eaded9">
<tr><td style="padding:28px 28px 8px"><a href="${HUB.website}"><img src="${HUB.logoUrl}" alt="${HUB.name}" width="120" style="display:block;width:120px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:8px 28px 32px">
  <h1 style="font-size:22px;line-height:1.3;margin:12px 0 8px">Welcome, ${esc(d.name)}! 👋</h1>
  <p style="margin:0 0 12px">${esc(opening)}</p>

  <h2 style="font-size:17px;margin:24px 0 6px">✨ Your first steps</h2>
  ${steps(d).map(
    (s, i) => `<p style="margin:0 0 12px"><strong>${s.emoji} ${i + 1}. ${esc(s.title)}.</strong> ${esc(s.text)}<br><a href="${esc(s.href)}" style="color:#b83500">${esc(s.label)}</a></p>`,
  ).join("\n  ")}

  <h2 style="font-size:17px;margin:24px 0 6px">🎁 What your membership gives you</h2>
  <ul style="margin:0;padding-left:20px">
    ${perks.map((p) => `<li style="margin:0 0 6px">${esc(p)}</li>`).join("\n    ")}
  </ul>
  <p style="margin:8px 0 0;font-size:14px;color:#5d625e">${esc(COWORKING_NOTE)}</p>

  <p style="margin:28px 0 0;font-size:15px">${questionsHtml}</p>
  <p style="margin:16px 0 0">See you at the hub! 🧡</p>
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">${HUB.name} · ${esc(HUB.address)} · <a href="${HUB.website}" style="color:#5d625e">commonshub.brussels</a></td></tr>
</table></td></tr></table>
</body></html>`

  const text = [
    `Welcome, ${d.name}! 👋`,
    "",
    opening,
    "",
    "✨ YOUR FIRST STEPS",
    ...steps(d).flatMap((s, i) => ["", `${s.emoji} ${i + 1}. ${s.title}. ${s.text}`, s.href]),
    "",
    "🎁 WHAT YOUR MEMBERSHIP GIVES YOU",
    ...perks.map((p) => `- ${p}`),
    "",
    COWORKING_NOTE,
    "",
    questions,
    "",
    "See you at the hub! 🧡",
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
