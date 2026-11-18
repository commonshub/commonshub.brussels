/** Current avatar URL per Discord user id, looked up when a recorded one is gone (an hour). */
const avatarLookups = new Map<string, { url: string | null; at: number }>();

/**
 * Avatars are stored as cdn.discordapp.com/avatars/<user id>/<hash>.png; the hash changes when the
 * member changes their picture, and the old URL then answers 404 (stale copies stay in older
 * dataset files and Nostr profiles). Ask Discord for the current hash, with the bot's token.
 */
export async function currentDiscordAvatar(url: string, now = Date.now(), fetcher: typeof fetch = fetch): Promise<string | null> {
  const m = /^https:\/\/cdn\.discordapp\.com\/avatars\/(\d{5,25})\/[\w]+\.(png|webp|jpg|gif)/.exec(url);
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!m || !token) return null;
  const id = m[1];
  const known = avatarLookups.get(id);
  if (known && now - known.at < 3_600_000) return known.url;
  let current: string | null = null;
  try {
    const res = await fetcher(`https://discord.com/api/v10/users/${id}`, { headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(5_000) });
    const user = res.ok ? ((await res.json()) as { avatar?: string | null }) : null;
    if (user?.avatar) current = `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.png?size=256`;
  } catch {
    /* Discord unreachable: no fallback this time */
  }
  avatarLookups.set(id, { url: current, at: now });
  return current;
}
