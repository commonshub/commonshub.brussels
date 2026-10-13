/**
 * A signed-in person's roles on the community's Discord, as they are now.
 * The session used to keep the roles it saw at sign-in, so a role given
 * later (a new member after paying, a steward giving one) only counted after
 * signing out and in again. Read through the bot, kept two minutes, and
 * forgotten as soon as the site itself gives a role.
 */

import settings from "@/settings/settings.json"

const TTL_MS = 2 * 60_000
const cache = new Map<string, { at: number; roles: string[] | null }>()
let guildRoles: { at: number; byId: Map<string, string> } | null = null

async function botGet(path: string): Promise<Response | null> {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) return null
  return fetch(`https://discord.com/api/v10${path}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" }).catch(() => null)
}

/** Their role ids now ([] when not in the server), or null when Discord can't tell (keep what the session has). */
export async function liveRoles(discordId: string): Promise<string[] | null> {
  const hit = cache.get(discordId)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.roles
  const res = await botGet(`/guilds/${settings.discord.guildId}/members/${discordId}`)
  const roles = !res ? null : res.ok ? (((await res.json()) as { roles?: string[] }).roles ?? []) : res.status === 404 ? [] : null
  cache.set(discordId, { at: Date.now(), roles })
  return roles
}

/** Role names, for the steward check (any role named *steward*). */
export async function roleNames(ids: string[]): Promise<Array<{ id: string; name: string }>> {
  if (!guildRoles || Date.now() - guildRoles.at > 10 * 60_000) {
    const res = await botGet(`/guilds/${settings.discord.guildId}/roles`)
    if (res?.ok) guildRoles = { at: Date.now(), byId: new Map(((await res.json()) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name])) }
  }
  return ids.map((id) => ({ id, name: guildRoles?.byId.get(id) ?? "Role" }))
}

/** After the site gave someone a role: read it again on their next page. */
export const forgetRoles = (discordId: string) => cache.delete(discordId)
