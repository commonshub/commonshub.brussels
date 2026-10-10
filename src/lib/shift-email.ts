/**
 * The confirmation for a caretaking shift sign-up: an email (with an .ics)
 * and a Discord DM, sent by the website after every sign-up made on the
 * community tablet. Same content as the Discord bot's /shifts confirmation
 * (opencollective/token-bot src/lib/shift-email.ts), so people get one
 * consistent message whichever way they signed up.
 */

/** The address to share for the handbook (it redirects to wherever the handbook lives, see lib/handbook.ts). */
export const HANDBOOK_URL = "https://commonshub.brussels/handbook";

export const HUB = {
  name: "Commons Hub Brussels",
  address: "Rue de la Madeleine 51, 1000 Brussels",
  website: "https://commonshub.brussels",
  logoUrl: "https://commonshub.brussels/brandkit/commonshub-logo-sticker.png",
  from: "Commons Hub Brussels <hello@commonshub.brussels>",
  replyTo: "hello@commonshub.brussels",
};
export const SHIFTS_CHANNEL_URL =
  "https://discord.com/channels/1280532848604086365/1484493597901455370";

export interface ShiftConfirmation {
  memberName: string;
  email?: string;
  start: Date;
  end: Date;
  timezone?: string;
  /** The event they steward, if any. */
  eventTitle?: string;
  reward: { amount: number; symbol: string };
  doorLink?: string | null;
  cancelUrl?: string;
  /** Google Calendar event id, so the .ics matches the calendar entry. */
  calendarEventId?: string;
  /** Who signed them up: themselves on Discord, or someone at the community tablet. */
  via?: "discord" | "tablet";
}

/** "Tue 7 Oct" in the hub's timezone. */
export function shortDay(d: Date, tz = "Europe/Brussels"): string {
  return d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz,
    })
    .replace(/,/g, "");
}

/** "Tuesday 7 October 2026" in the hub's timezone. */
export function longDay(d: Date, tz = "Europe/Brussels"): string {
  return d
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: tz,
    })
    .replace(/,/g, "");
}

/** "17:30" in the hub's timezone. */
export function hhmm(d: Date, tz = "Europe/Brussels"): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function rewardText(r: { amount: number; symbol: string }): string {
  const n = Number.isInteger(r.amount)
    ? String(r.amount)
    : String(Number(r.amount.toFixed(2)));
  return `${n} ${r.amount === 1 ? "token" : "tokens"}`;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function buildShiftEmail(d: ShiftConfirmation): {
  subject: string;
  html: string;
  text: string;
} {
  const tz = d.timezone || "Europe/Brussels";
  const time = `${hhmm(d.start, tz)}–${hhmm(d.end, tz)}`;
  const subject = `You're on shift: ${shortDay(d.start, tz)}, ${time} at the Commons Hub`;
  const when = `${longDay(d.start, tz)}, ${time}`;
  const where = `${HUB.address} (right in front of Brussels Central Station)`;
  const reward = `${rewardText(d.reward)}, to claim after the shift as usual`;

  const intro =
    d.via === "tablet"
      ? `Someone signed you up for a caretaking shift at the community tablet in the hub. Thank you for taking care of the Commons Hub!`
      : `You signed up for a caretaking shift. Thank you for taking care of the Commons Hub!`;
  const why = [
    `The Commons Hub only exists because members take care of it. Shifts are how we keep this common space open, tidy and welcoming.`,
    `On shift, you're the host: greet people as they arrive, show them around, and make them feel at home. Many people discover the hub during an event, and "we never have the opportunity to make a good first impression twice".`,
    `A great first experience is what turns visitors into a community of users of the space who keep coming back. That community is our primary way of funding the space.`,
  ];
  const practical = `Everything practical (opening and closing, the door, the kitchen, the fridge…) is in the Commons Hub Handbook.`;
  const questions = `Questions? Ask Elinor on Discord, or post in #shifts.`;
  const cantMake = d.cancelUrl
    ? `Can't make it${d.via === "tablet" ? ", or it wasn't you" : ""}? Cancel with the link below, or with /shifts on Discord.`
    : `Can't make it? Cancel with /shifts on Discord.`;

  const doorNotes = [
    `Tap the button when you are at the door: it opens the door for you.`,
    `It works from 30 minutes before your shift until 30 minutes after it.`,
    `The link is personal: please don't share it.`,
  ];

  const button = (
    href: string,
    label: string,
    color = "#001309",
    border = "#001309",
  ) =>
    `<a href="${esc(href)}" style="display:inline-block;background:#ffffff;color:${color};border:2px solid ${border};text-decoration:none;font-weight:600;padding:9px 18px;border-radius:8px">${label}</a>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FBF4F2;color:#001309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;border:1px solid #eaded9">
<tr><td style="padding:28px 28px 8px" align="left">
  <a href="${HUB.website}"><img src="${HUB.logoUrl}" alt="${HUB.name}" width="120" style="display:block;width:120px;height:auto;border:0"></a>
</td></tr>
<tr><td style="padding:8px 28px 32px">
  <h1 style="font-size:22px;line-height:1.3;margin:12px 0 8px">Hi ${esc(d.memberName)}, you're on shift</h1>
  <p style="margin:0 0 16px">${esc(intro)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4F2;border-radius:10px">
    <tr><td style="padding:16px 18px;font-size:15px">
      <div><strong>When:</strong> ${esc(when)}</div>
      <div><strong>Where:</strong> ${esc(where)}</div>
      ${d.eventTitle ? `<div><strong>You steward:</strong> ${esc(d.eventTitle)}</div>` : ""}
      <div><strong>Reward:</strong> ${esc(reward)}</div>
    </td></tr>
  </table>
  <p style="margin:12px 0 0;font-size:14px;color:#5d625e">The calendar file is attached: open it to add the shift to your calendar.</p>
${
  d.doorLink
    ? `
  <h2 style="font-size:17px;margin:28px 0 6px">Getting in</h2>
  <p style="margin:8px 0">${button(d.doorLink, "🚪 Open the door")}</p>
  <ul style="margin:8px 0 0;padding-left:20px;font-size:15px">${doorNotes.map((n) => `<li style="margin-bottom:4px">${esc(n)}</li>`).join("")}</ul>`
    : ""
}

  <h2 style="font-size:17px;margin:28px 0 6px">Why shifts matter</h2>
  ${why.map((p) => `<p style="margin:0 0 8px">${esc(p)}</p>`).join("\n  ")}

  <h2 style="font-size:17px;margin:28px 0 6px">Everything practical</h2>
  <p style="margin:0 0 8px">${esc(practical)}</p>
  <p style="margin:12px 0 0">${button(HANDBOOK_URL, "Commons Hub Handbook", "#b83500", "#FF4C02")}</p>

  <h2 style="font-size:17px;margin:28px 0 6px">Questions, or can't make it?</h2>
  <p style="margin:0 0 8px">Questions? Ask Elinor on Discord, or post in <a href="${SHIFTS_CHANNEL_URL}" style="color:#b83500">#shifts</a>.</p>
  <p style="margin:0 0 8px">${esc(cantMake)}</p>
  ${d.cancelUrl ? `<p style="margin:12px 0 0">${button(d.cancelUrl, "Cancel this shift", "#5d625e", "#c9c2bf")}</p>` : ""}
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:13px;color:#5d625e;border-top:1px solid #eaded9">
  ${HUB.name} · ${esc(HUB.address)} · <a href="${HUB.website}" style="color:#5d625e">commonshub.brussels</a>
</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    `Hi ${d.memberName}, you're on shift`,
    "",
    intro,
    "",
    `When: ${when}`,
    `Where: ${where}`,
    ...(d.eventTitle ? [`You steward: ${d.eventTitle}`] : []),
    `Reward: ${reward}`,
    "The calendar file is attached.",
    ...(d.doorLink
      ? [
          "",
          "GETTING IN",
          `Open the door: ${d.doorLink}`,
          ...doorNotes.map((n) => `- ${n}`),
        ]
      : []),
    "",
    "WHY SHIFTS MATTER",
    ...why,
    "",
    "EVERYTHING PRACTICAL",
    practical,
    `Handbook: ${HANDBOOK_URL}`,
    "",
    "QUESTIONS, OR CAN'T MAKE IT?",
    questions,
    cantMake,
    ...(d.cancelUrl ? [`Cancel: ${d.cancelUrl}`] : []),
    "",
    `${HUB.name} · ${HUB.address} · ${HUB.website}`,
  ].join("\n");

  return { subject, html, text };
}

const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
const icsDate = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export function buildShiftIcs(d: ShiftConfirmation): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Commons Hub Brussels//Shifts//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${d.calendarEventId ? `${d.calendarEventId}@commonshub.brussels` : `shift-${d.start.getTime()}@commonshub.brussels`}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(d.start)}`,
    `DTEND:${icsDate(d.end)}`,
    `SUMMARY:${icsText(`Caretaking shift${d.eventTitle ? `: ${d.eventTitle}` : ""} (Commons Hub Brussels)`)}`,
    `LOCATION:${icsText(`${HUB.name}, ${HUB.address}`)}`,
    `DESCRIPTION:${icsText([d.eventTitle ? `You steward: ${d.eventTitle}` : "", `Handbook: ${HANDBOOK_URL}`, d.doorLink ? `Open the door: ${d.doorLink}` : "", d.cancelUrl ? `Cancel: ${d.cancelUrl}` : ""].filter(Boolean).join("\n"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Send the confirmation email (Resend). */
export async function sendShiftConfirmation(
  d: ShiftConfirmation,
): Promise<{ id: string }> {
  if (!d.email) throw new Error("no email address");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const { subject, html, text } = buildShiftEmail(d);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: HUB.from,
      to: [d.email],
      reply_to: [HUB.replyTo],
      subject,
      html,
      text,
      attachments: [
        {
          filename: "commonshub-shift.ics",
          content: Buffer.from(buildShiftIcs(d)).toString("base64"),
          content_type: "text/calendar; charset=utf-8; method=PUBLISH",
        },
      ],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string };
  if (!res.ok)
    throw new Error(
      `Resend ${res.status}: ${JSON.stringify(body).slice(0, 200)}`,
    );
  return { id: body.id || "" };
}

/** The Discord DM after a sign-up made at the tablet. */
/** A link button under a Discord message (Discord allows URLs up to 512 characters). */
export interface DmButton {
  label: string
  url: string
  emoji?: string
}

/**
 * The Discord DM confirming a shift: the details as text, and the long links
 * (open the door, cancel) as buttons under it rather than spelled out. A link
 * too long for a button stays in the text, as a short masked link.
 */
export function buildShiftDm(d: ShiftConfirmation): { content: string; buttons: DmButton[] } {
  const tz = d.timezone || "Europe/Brussels";
  const buttons: DmButton[] = [];
  const masked: string[] = [];
  const link = (label: string, url: string, emoji: string) => (url.length <= 512 ? buttons.push({ label, url, emoji }) : masked.push(`${emoji} [${label}](<${url}>)`));
  if (d.doorLink) link("Open the door", d.doorLink, "🚪");
  link("Handbook", HANDBOOK_URL, "📖");
  if (d.cancelUrl) link("Cancel", d.cancelUrl, "✖️");
  const lines = [
    `📋 **You're on shift: ${longDay(d.start, tz)}, ${hhmm(d.start, tz)}–${hhmm(d.end, tz)}** at the Commons Hub${d.via === "tablet" ? " (signed up at the community tablet)" : ""}.`,
    ...(d.eventTitle ? [`🎪 You steward: **${d.eventTitle}**`] : []),
    `🪙 Reward: ${rewardText(d.reward)}, to claim after the shift as usual.`,
    ...(d.doorLink ? ["🚪 The door button works from 30 minutes before your shift."] : []),
    ...masked,
    ...(d.cancelUrl ? ["Not you, or can't make it? Cancel below."] : []),
  ];
  return { content: lines.join("\n"), buttons };
}

/** The Discord DM after a cancellation from the cancel link. */
export function buildShiftCancelledDm(
  start: Date,
  end: Date,
  tz = "Europe/Brussels",
): string {
  return `❌ Your shift on **${longDay(start, tz)}, ${hhmm(start, tz)}–${hhmm(end, tz)}** at the Commons Hub was cancelled.`;
}
