/**
 * Discord attachment links are signed and expire after about a day
 * (`ex` = expiry, hex Unix seconds). The photos chb publishes keep the link
 * from when they were posted, so the image proxy renews expired ones through
 * the bot (POST /attachments/refresh-urls) before fetching them.
 */

const DISCORD_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"])
const API = "https://discord.com/api/v10/attachments/refresh-urls"
const BATCH_MS = 25
const BATCH_MAX = 50

export function isDiscordAttachmentUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return DISCORD_HOSTS.has(u.hostname) && u.pathname.startsWith("/attachments/")
  } catch {
    return false
  }
}

/** The attachment itself, without the signature: the same across renewals. */
export function attachmentKey(url: string): string {
  const u = new URL(url)
  return `${u.hostname}${u.pathname}`
}

/** Expiry in Unix seconds, or null when the link carries none. */
export function attachmentExpiry(url: string): number | null {
  const ex = new URL(url).searchParams.get("ex")
  if (!ex || !/^[0-9a-f]+$/i.test(ex)) return null
  return parseInt(ex, 16)
}

/** Expired, or expiring within the margin (seconds). A link without `ex` counts as expired. */
export function isExpired(url: string, now = Date.now() / 1000, margin = 300): boolean {
  const ex = attachmentExpiry(url)
  return ex === null || ex <= now + margin
}

const renewed = new Map<string, string>() // attachmentKey → fresh signed link
let queue: Array<{ url: string; resolve: (fresh: string | null) => void }> = []
let timer: ReturnType<typeof setTimeout> | null = null

async function flush(): Promise<void> {
  const batch = queue.splice(0, BATCH_MAX)
  timer = queue.length ? setTimeout(flush, 0) : null
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) return batch.forEach((b) => b.resolve(null))
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ attachment_urls: [...new Set(batch.map((b) => b.url))] }),
    })
    if (!res.ok) throw new Error(`Discord answered ${res.status}`)
    const data = (await res.json()) as { refreshed_urls?: Array<{ original: string; refreshed: string }> }
    const byKey = new Map<string, string>()
    for (const r of data.refreshed_urls ?? []) {
      if (r.refreshed && isDiscordAttachmentUrl(r.refreshed)) byKey.set(attachmentKey(r.original), r.refreshed)
    }
    for (const b of batch) {
      const fresh = byKey.get(attachmentKey(b.url)) ?? null
      if (fresh) renewed.set(attachmentKey(b.url), fresh)
      b.resolve(fresh)
    }
  } catch (error) {
    console.warn("[discord-attachments] could not renew links:", error)
    batch.forEach((b) => b.resolve(null))
  }
}

/**
 * A link to the same attachment that works now; the original when it cannot
 * be renewed. `force` renews even a link that has not expired (it was refused).
 */
export async function freshAttachmentUrl(url: string, { force = false } = {}): Promise<string> {
  if (!isDiscordAttachmentUrl(url)) return url
  const known = renewed.get(attachmentKey(url))
  if (!force && known && !isExpired(known)) return known
  if (!force && !isExpired(url)) return url
  const fresh = await new Promise<string | null>((resolve) => {
    queue.push({ url, resolve })
    if (queue.length >= BATCH_MAX) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 0)
    } else if (!timer) {
      timer = setTimeout(flush, BATCH_MS)
    }
  })
  return fresh ?? url
}

/** For tests. */
export function resetRenewals(): void {
  renewed.clear()
  queue = []
  if (timer) clearTimeout(timer)
  timer = null
}
