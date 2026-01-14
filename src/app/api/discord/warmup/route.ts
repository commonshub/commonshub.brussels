import { NextResponse } from "next/server"
import { getChannelMessages, isDiscordConfigured } from "@/lib/discord"
import {
  addMessagesToCache,
  getOldestCachedMessageId,
  getNewestCachedMessageId,
  getCacheStats,
  hasCacheData,
  type CachedMessage,
} from "@/lib/discord-cache"
import settings from "@/settings/settings.json"

// Get all channel IDs from settings
function getAllChannelIds(): string[] {
  const channelIds = new Set<string>()
  const channels = settings.discord.channels

  // Add top-level channels
  if (channels.general) channelIds.add(channels.general)
  if (channels.introductions) channelIds.add(channels.introductions)
  if (channels.requests) channelIds.add(channels.requests)
  if (channels.contributions) channelIds.add(channels.contributions)

  // Add room channels
  if (channels.rooms) {
    Object.values(channels.rooms).forEach((id) => channelIds.add(id))
  }

  // Add activity channels
  if (channels.activities) {
    Object.values(channels.activities).forEach((id) => channelIds.add(id))
  }

  return Array.from(channelIds)
}

const CHANNELS_TO_CACHE = getAllChannelIds()

/**
 * Warm up Discord cache by fetching all historical messages
 * GET: Fetch new messages since last cache
 * POST: Force full historical fetch (going backwards)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const forceHistorical = searchParams.get("historical") === "true"

  if (!isDiscordConfigured()) {
    return NextResponse.json({ error: "Discord not configured" }, { status: 500 })
  }

  const results: Record<string, { fetched: number; total: number; error?: string }> = {}

  for (const channelId of CHANNELS_TO_CACHE) {
    try {
      let totalFetched = 0

      if (forceHistorical || !hasCacheData(channelId)) {
        // Fetch historical messages going backwards
        console.log(`[v2] Discord warmup: fetching historical for ${channelId}`)
        let oldestId = getOldestCachedMessageId(channelId)
        let hasMore = true
        let iterations = 0
        const maxIterations = 50 // Safety limit

        while (hasMore && iterations < maxIterations) {
          iterations++
          const messages: CachedMessage[] = await getChannelMessages(channelId, {
            limit: 100,
            before: oldestId || undefined,
          })

          if (messages.length === 0) {
            hasMore = false
            break
          }

          addMessagesToCache(channelId, messages)
          totalFetched += messages.length

          // Get the oldest message ID for next iteration
          const sortedMessages = messages.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          )
          oldestId = sortedMessages[0].id

          // If we got fewer than 100 messages, we've reached the beginning
          if (messages.length < 100) {
            hasMore = false
          }

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } else {
        // Fetch only new messages since last cache
        console.log(`[v2] Discord warmup: fetching new messages for ${channelId}`)
        const newestId = getNewestCachedMessageId(channelId)

        // Fetch latest messages
        const messages: CachedMessage[] = await getChannelMessages(channelId, {
          limit: 100,
        })

        // Filter out messages we already have
        const newMessages = newestId ? messages.filter((m) => m.id > newestId) : messages

        if (newMessages.length > 0) {
          addMessagesToCache(channelId, newMessages)
          totalFetched = newMessages.length
        }
      }

      const stats = getCacheStats(channelId)
      results[channelId] = {
        fetched: totalFetched,
        total: stats.totalMessages,
      }
    } catch (error) {
      console.error(`Error warming up channel ${channelId}:`, error)
      results[channelId] = {
        fetched: 0,
        total: 0,
        error: String(error),
      }
    }
  }

  return NextResponse.json({
    success: true,
    results,
    timestamp: new Date().toISOString(),
  })
}

/**
 * POST: Force full historical fetch
 */
export async function POST() {
  // Redirect to GET with historical flag
  const response = await GET(new Request("http://localhost/api/discord/warmup?historical=true"))
  return response
}
