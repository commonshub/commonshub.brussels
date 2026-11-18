import { lookupMember } from "./day-data"
import { isDiscordConfigured, searchGuildMembers } from "./discord"
import settings from "@/settings/settings.json"

/**
 * A member by their Discord username (exact, ignoring case), for an admin's /?as=<username>:
 * what the dashboard needs to render as them. Null when nobody on the guild has that username,
 * or they don't have the member role.
 */
export async function findMemberByUsername(username: string): Promise<{ discordId: string; username: string; avatar: string | null } | null> {
  const wanted = username.trim().replace(/^@/, "").toLowerCase().slice(0, 40)
  if (!/^[a-z0-9_.]{2,32}$/.test(wanted) || !isDiscordConfigured()) return null
  const match = (await searchGuildMembers(settings.discord.guildId, wanted, 10).catch(() => [])).find((m) => m.username.toLowerCase() === wanted)
  if (!match) return null
  const member = await lookupMember(match.id)
  return member ? { discordId: member.id, username: member.username ?? match.username, avatar: member.avatar ?? match.avatar } : null
}
