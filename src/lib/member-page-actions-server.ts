/**
 * The server side of a member's page's actions (lib/member-page-actions.ts):
 * the checks on the author's chosen channel at publish, and the sends.
 */

import settings from "@/settings/settings.json"

import { discordFetch, discordPost, sendDirectMessage } from "./discord"
import { fromSite } from "./email-address"
import { canPost, channelPermissions, discordText, emailText, RateLimiter, type ActionContext, type Overwrite, type PageAction } from "./member-page-actions"
import type { MemberPage } from "./member-pages"

const HELLO = "hello@commonshub.brussels"
const TEXT_TYPES = new Set([0, 5])
const THREAD_TYPES = new Set([10, 11, 12])

/**
 * The channel a page may post in, checked when it is published: a text
 * channel or thread of our server where its author can post themselves.
 */
export async function checkPageChannel(channelId: string, authorId: string): Promise<{ id: string; name: string }> {
  if (!/^\d{5,25}$/.test(channelId)) throw new Error("discordChannel must be a channel id (digits)")
  const guildId = settings.discord.guildId
  const res = await discordFetch(`/channels/${channelId}`)
  if (!res.ok) throw new Error("The bot can't see that channel")
  const channel = (await res.json()) as { id: string; name?: string; type: number; guild_id?: string; parent_id?: string; permission_overwrites?: Overwrite[] }
  if (channel.guild_id !== guildId) throw new Error("That channel is not on the Commons Hub server")
  const thread = THREAD_TYPES.has(channel.type)
  if (!thread && !TEXT_TYPES.has(channel.type)) throw new Error("Pick a text channel or a thread")
  let overwrites = channel.permission_overwrites ?? []
  if (thread && channel.parent_id) {
    const parent = await discordFetch(`/channels/${channel.parent_id}`)
    overwrites = parent.ok ? (((await parent.json()) as { permission_overwrites?: Overwrite[] }).permission_overwrites ?? []) : []
  }
  const [memberRes, rolesRes, guildRes] = await Promise.all([
    discordFetch(`/guilds/${guildId}/members/${authorId}`),
    discordFetch(`/guilds/${guildId}/roles`),
    discordFetch(`/guilds/${guildId}`),
  ])
  if (!memberRes.ok || !rolesRes.ok) throw new Error("Could not read the author's permissions")
  const perms = channelPermissions({
    guildId,
    ownerId: guildRes.ok ? ((await guildRes.json()) as { owner_id?: string }).owner_id : undefined,
    userId: authorId,
    memberRoles: ((await memberRes.json()) as { roles?: string[] }).roles ?? [],
    roles: (await rolesRes.json()) as Array<{ id: string; permissions: string }>,
    overwrites,
  })
  if (!canPost(perms, thread)) throw new Error("The author can't post in that channel themselves, so their page can't either")
  return { id: channel.id, name: channel.name ?? channel.id }
}

/** Five sends per page per person every 10 minutes, 30 a day per person. */
const limiter = new RateLimiter([
  { max: 5, windowMs: 10 * 60_000 },
  { max: 30, windowMs: 24 * 3600_000 },
])

export class ActionError extends Error {}

export async function runPageAction(page: MemberPage, action: PageAction, sender: { discordId: string; username: string }, pageUrl: string): Promise<{ sent: string }> {
  if (!limiter.take([`${sender.discordId}:${page.username}/${page.slug}`, sender.discordId])) throw new ActionError("Too many sends from this page: try again later")
  const ctx: ActionContext = { pageTitle: page.title, pageUrl, author: page.username, sender: sender.username }

  if (action.kind === "discord") {
    const content = discordText(action, ctx)
    if (action.to === "author") {
      if (!(await sendDirectMessage(page.discordId, content))) throw new ActionError(`Could not DM @${page.username}`)
      return { sent: `DM to @${page.username}` }
    }
    if (!page.discordChannel) throw new ActionError("This page has no Discord channel to post in")
    const res = await discordPost(`/channels/${page.discordChannel.id}/messages`, { content, allowed_mentions: { parse: [] }, flags: 4 })
    if (!res.ok) throw new ActionError("Discord refused the message")
    return { sent: `#${page.discordChannel.name}` }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new ActionError("Email is not set up")
  const { subject, text } = emailText(action, ctx)
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromSite(), to: [HELLO], reply_to: [action.replyTo ?? HELLO], subject, text }),
  })
  if (!res.ok) throw new ActionError("The email could not be sent")
  return { sent: HELLO }
}
