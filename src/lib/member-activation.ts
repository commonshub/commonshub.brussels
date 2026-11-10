/**
 * A paying member signed in with Discord, but without the member role: the
 * site sees a visitor (no dashboard, no door), and nothing on it could tell
 * otherwise, since every way of finding a plan was for members only. It
 * happens to whoever paid without following the onboarding email's link
 * (lib/membership-applications-store.ts claimMemberRole), or from before it.
 *
 * Here the site finds the membership they pay for, by an address that is
 * provably theirs (their verified Discord email, or one they confirm with a
 * code: /api/members/email), gives them the role and records the link for
 * chb (lib/discord-links.ts). Never by name: the role opens the door.
 */

import { grantGuildRole, isDiscordConfigured, sendMessage } from "./discord"
import { cachedLinks, recordLoginLink, type DiscordLink } from "./discord-links"
import { forgetRoles } from "./live-roles"
import { readMembers } from "./member-plan"
import settings from "@/settings/settings.json"
import type { Member } from "@/types/members"

const CURRENT: Member["status"][] = ["active", "trialing", "grace", "past_due"]

/**
 * The current membership paid with this address (its salted hash), if this
 * Discord account may take it: "taken" when another account already
 * confirmed it as theirs (a membership is one person's).
 */
export function membershipToActivate(emailHash: string | null, discordId: string, members: Member[] | null, links: Pick<DiscordLink, "discordId" | "emailHash" | "source">[]): Member | "none" | "taken" {
  const entry = emailHash ? (members ?? []).find((m) => m.accounts?.emailHash === emailHash && CURRENT.includes(m.status)) : null
  if (!entry) return "none"
  const others = links.filter((l) => l.emailHash === emailHash && l.discordId !== discordId && l.source !== "name" && l.source !== "checkout")
  return others.length ? "taken" : entry
}

/** Whether a current membership is paid with this address: a code is only mailed to those. */
export const paysMembership = (emailHash: string | null): boolean => !!emailHash && (readMembers() ?? []).some((m) => m.accounts?.emailHash === emailHash && CURRENT.includes(m.status))

export type Activation = { ok: true } | { ok: false; reason: "none" | "taken" | "not-in-server" | "failed" }

/** Give the member role to a signed-in person whose address (`how` they proved it) pays a current membership. */
export async function activateMembership(user: { discordId: string; accessToken?: string }, emailHash: string | null, how: "login" | "email"): Promise<Activation> {
  const entry = membershipToActivate(emailHash, user.discordId, readMembers(), await cachedLinks())
  if (entry === "none" || entry === "taken") return { ok: false, reason: entry }
  if (!isDiscordConfigured()) return { ok: false, reason: "failed" }
  const granted = await grantGuildRole(settings.discord.guildId, user.discordId, settings.discord.roles.member, user.accessToken)
  if (granted !== "granted") return { ok: false, reason: granted }
  forgetRoles(user.discordId)
  await recordLoginLink(user.discordId, emailHash, new Date(), how)
  sendMessage(
    settings.discord.channels.membership,
    `🔑 <@${user.discordId}> signed in on the website without the member role: we found the membership they pay for (${entry.firstName}, by ${how === "login" ? "their Discord email" : "an address they confirmed with a code"}) and gave them the role.`,
  ).catch(() => {})
  return { ok: true }
}

/** What to tell them when it didn't work (none: ask for the address they pay with instead). */
export const ACTIVATION_ERRORS: Record<Exclude<Activation, { ok: true }>["reason"], { error: string; status: number }> = {
  none: { error: "We couldn't find a membership paid with that address.", status: 404 },
  taken: { error: "This membership is already linked to another Discord account. Write to hello@commonshub.brussels and we'll sort it out.", status: 409 },
  "not-in-server": { error: "You're not in our Discord server yet: join it, then try again.", status: 409 },
  failed: { error: "We found your membership but couldn't give you the member role. Write to hello@commonshub.brussels and a steward will do it by hand.", status: 502 },
}
