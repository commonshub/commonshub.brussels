/**
 * A month's photos from #contributions, for the carousel the recap emails link to
 * (/contributions/YYYY/MM/photos). The photos are public (latest public tier:
 * images.json, the contributions channel); what was said with them is members
 * tier (contributions.json), so captions are only joined for a member or for
 * someone holding a recap link's signed token.
 */

import settings from "@/settings/settings.json"
import { readTierJson } from "./dataset"
import { plainText, type ChannelFeed } from "./contributions-screen"
import { photoSource } from "./photos"

export interface ContributionPhoto {
  /** The image id (its file name): ?image= in the URL. */
  id: string
  url: string
  author: { id: string; displayName: string; avatar: string | null }
  timestamp: string
  caption?: string
}

interface ImagesFile {
  images?: Array<{ id: string; url?: string; filePath?: string; channelId?: string; timestamp?: string; author?: { id?: string; displayName?: string; username?: string; avatar?: string | null } }>
}

export function contributionPhotos(year: string, month: string, { withCaptions = false } = {}): ContributionPhoto[] {
  const channel = settings.discord.channels.contributions
  const file = readTierJson<ImagesFile>("public", "images.json", year, month)
  const captions = new Map<string, string>()
  if (withCaptions) {
    for (const m of readTierJson<ChannelFeed>("members", "contributions.json", year, month)?.messages ?? []) {
      const text = plainText(m.content)
      if (text) for (const img of m.images ?? []) captions.set(String(img), text)
    }
  }
  return (file?.images ?? [])
    .filter((i) => i.channelId === channel && i.filePath)
    .sort((a, b) => Date.parse(a.timestamp ?? "") - Date.parse(b.timestamp ?? ""))
    .map((i) => ({
      id: i.id,
      url: photoSource({ url: i.url ?? "", filePath: i.filePath! }),
      author: { id: i.author?.id ?? "", displayName: i.author?.displayName || i.author?.username || "", avatar: i.author?.avatar ?? null },
      timestamp: i.timestamp ?? "",
      ...(captions.get(i.filePath!) ? { caption: captions.get(i.filePath!) } : {}),
    }))
}
