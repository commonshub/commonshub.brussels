import { randomBytes } from "crypto"
import { NextResponse } from "next/server"

import { createDiscordThread } from "@/lib/discord"
import settings from "@/settings/settings.json"
import { PENDING_URL, parseApplication, spamReason } from "@/lib/membership-application"
import { VOUCH_EMOJI } from "@/lib/membership-application"
import { addVouchReaction, isApplicationsConfigured, saveApplication, sendReceived } from "@/lib/membership-applications-store"

/** Ten applications in ten minutes is plenty. */
const WINDOW_MS = 10 * 60_000
const recent: number[] = []

/**
 * An application to become a member: kept (encrypted) on the community
 * relays for members to vouch on /members/pending, confirmed to the
 * applicant by email (cc hello@), and announced in #requests without the
 * email address.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  // Bots get the same answer as people, and nothing is kept, emailed or posted.
  const spam = spamReason(body)
  if (spam) {
    console.log(`[membership] ignored a bot application (${spam}): ${String(body.name ?? "").slice(0, 60)}`)
    return NextResponse.json({ success: true })
  }
  const application = parseApplication(body, randomBytes(6).toString("base64url"))
  if ("error" in application) return NextResponse.json({ error: application.error }, { status: 400 })

  const now = Date.now()
  while (recent.length && recent[0] < now - WINDOW_MS) recent.shift()
  if (recent.length >= 10) return NextResponse.json({ error: "Too many applications right now, please try again in a few minutes" }, { status: 429 })
  recent.push(now)

  // Kept for vouching; if the relays refuse it, the application still reaches us (email cc hello@, #requests).
  let saved = false
  if (isApplicationsConfigured()) {
    saved = await saveApplication(application)
      .then(() => true)
      .catch((error) => (console.error("[membership] could not keep the application on the relays:", error), false))
  }
  try {
    await sendReceived(application)
  } catch (error) {
    console.error("[membership] could not record the application:", error)
    return NextResponse.json({ error: "Failed to send application. Please try again." }, { status: 500 })
  }

  const a = application
  const lines = [
    `👋 **New membership application: ${a.name}** (${a.type}${a.people ? `, ${a.people} people` : ""})`,
    ...(a.website ? [`**Website:** ${/^https?:\/\//.test(a.website) ? `<${a.website}>` : a.website}`] : []),
    ...(a.needs.length ? [`**Needs:** ${a.needs.join("; ")}`] : []),
    ...(a.contribute ? [`**Can contribute:** ${a.contribute}`] : []),
    ...(a.heardFrom ? [`**Heard about us:** ${a.heardFrom}`] : []),
    ...(a.knows?.length || a.whoYouKnow ? [`**Knows at the hub:** ${[...(a.knows ?? []).map((k) => `<@${k.discordId}>`), ...(a.whoYouKnow ? [a.whoYouKnow] : [])].join(", ")}`] : []),
    ...(a.notes ? [`**Notes:** ${a.notes}`] : []),
    "",
    ...(a.knows?.length ? [`${a.knows.map((k) => `<@${k.discordId}>`).join(" ")} ${a.name} says they know you: can you vouch for them?`] : []),
    saved
      ? `Members with tokens: react with ${VOUCH_EMOJI} to vouch, or vouch on [the pending applications](<${PENDING_URL}>). 3 vouches and they're in.`
      : "⚠️ Could not add it to /members/pending: a steward needs to handle it by hand.",
  ]
  const post = await createDiscordThread(settings.discord.channels.requests, `👤 Membership: ${a.name}`.slice(0, 100), lines.join("\n").slice(0, 1900)).catch((error) => {
    console.error("[membership] could not post the application on Discord:", error)
    return null
  })
  // A thread started from a message has the message's id: members vouch by reacting on it.
  if (saved && post?.threadId) {
    await addVouchReaction(post.threadId)
    await saveApplication({ ...a, discordMessageId: post.threadId }).catch((error) => console.error("[membership] could not record the post:", error))
  }
  return NextResponse.json({ success: true })
}
