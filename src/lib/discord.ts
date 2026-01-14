/**
 * Centralized Discord API client with rate limiting, caching, and logging
 */

const DISCORD_API_BASE = "https://discord.com/api/v10"

// Track all API calls for debugging
let callCount = 0

const CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds
const responseCache = new Map<string, { data: unknown; timestamp: number }>()

interface RateLimitResponse {
  message: string
  retry_after: number
  global: boolean
}

/**
 * Generate a cache key from endpoint and method
 */
function getCacheKey(endpoint: string, method: string): string {
  return `${method}:${endpoint}`
}

/**
 * Check if cached response is still valid
 */
function getCachedResponse(cacheKey: string): unknown | null {
  const cached = responseCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[v2] Discord API cache HIT: ${cacheKey}`)
    return cached.data
  }
  if (cached) {
    // Expired, remove from cache
    responseCache.delete(cacheKey)
  }
  return null
}

/**
 * Store response in cache
 */
function setCachedResponse(cacheKey: string, data: unknown): void {
  responseCache.set(cacheKey, { data, timestamp: Date.now() })
  console.log(`[v2] Discord API cache SET: ${cacheKey} (cache size: ${responseCache.size})`)
}

/**
 * Make a Discord API request with automatic rate limit handling and caching for GET requests
 */
export async function discordFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = process.env.DISCORD_BOT_TOKEN

  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN not configured")
  }

  const url = endpoint.startsWith("http") ? endpoint : `${DISCORD_API_BASE}${endpoint}`
  const method = options.method || "GET"

  const cacheKey = getCacheKey(endpoint, method)
  if (method === "GET") {
    const cachedData = getCachedResponse(cacheKey)
    if (cachedData !== null) {
      // Return a mock Response with cached data
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Cache": "HIT" },
      })
    }
  }

  const fetchWithRetry = async (attempt = 1): Promise<Response> => {
    callCount++
    const callId = callCount

    console.log(`[v2] Discord API call #${callId}: ${method} ${endpoint}`)

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    // Handle rate limiting
    if (response.status === 429) {
      const data: RateLimitResponse = await response.json()
      // Round up and add a small buffer
      const waitTime = Math.ceil(data.retry_after * 1000) + 100

      console.log(`[v2] Discord API call #${callId}: Rate limited, waiting ${waitTime}ms (attempt ${attempt}/3)`)

      if (attempt >= 3) {
        console.error(`[v2] Discord API call #${callId}: Max retries exceeded`)
        throw new Error(`Discord rate limit exceeded after ${attempt} attempts`)
      }

      await new Promise((resolve) => setTimeout(resolve, waitTime))
      return fetchWithRetry(attempt + 1)
    }

    console.log(`[v2] Discord API call #${callId}: ${response.status} ${response.statusText}`)

    if (method === "GET" && response.ok) {
      const clonedResponse = response.clone()
      const data = await clonedResponse.json()
      setCachedResponse(cacheKey, data)
    }

    return response
  }

  return fetchWithRetry()
}

/**
 * GET request to Discord API
 */
export async function discordGet(endpoint: string): Promise<Response> {
  return discordFetch(endpoint, { method: "GET" })
}

/**
 * POST request to Discord API
 */
export async function discordPost(endpoint: string, body: unknown): Promise<Response> {
  return discordFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/**
 * Get guild info with member count
 */
export async function getGuild(guildId: string) {
  const response = await discordGet(`/guilds/${guildId}?with_counts=true`)
  if (!response.ok) {
    throw new Error(`Failed to get guild: ${response.status}`)
  }
  return response.json()
}

/**
 * Get all channels in a guild
 */
export async function getGuildChannels(guildId: string) {
  const response = await discordGet(`/guilds/${guildId}/channels`)
  if (!response.ok) {
    throw new Error(`Failed to get channels: ${response.status}`)
  }
  return response.json()
}

/**
 * Get guild roles
 */
export async function getGuildRoles(guildId: string) {
  const response = await discordGet(`/guilds/${guildId}/roles`)
  if (!response.ok) {
    throw new Error(`Failed to get roles: ${response.status}`)
  }
  return response.json()
}

/**
 * Get guild members
 */
export async function getGuildMembers(guildId: string, limit = 1000) {
  const response = await discordGet(`/guilds/${guildId}/members?limit=${limit}`)
  if (!response.ok) {
    throw new Error(`Failed to get members: ${response.status}`)
  }
  return response.json()
}

/**
 * Get messages from a channel
 */
export async function getChannelMessages(channelId: string, options: { limit?: number; before?: string } = {}) {
  const params = new URLSearchParams()
  params.set("limit", String(options.limit || 100))
  if (options.before) {
    params.set("before", options.before)
  }

  const response = await discordGet(`/channels/${channelId}/messages?${params}`)
  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.status}`)
  }
  return response.json()
}

/**
 * Get reactions for a message
 * @param channelId - The channel ID
 * @param messageId - The message ID
 * @param emoji - The emoji to get reactions for (URL-encoded, e.g., "👍" or "name:id" for custom emojis)
 * @param options - Optional parameters (limit, after)
 */
export async function getMessageReactions(
  channelId: string,
  messageId: string,
  emoji: string,
  options: { limit?: number; after?: string } = {},
) {
  const params = new URLSearchParams()
  if (options.limit) {
    params.set("limit", String(options.limit))
  }
  if (options.after) {
    params.set("after", options.after)
  }

  const encodedEmoji = encodeURIComponent(emoji)
  const queryString = params.toString() ? `?${params}` : ""
  const response = await discordGet(`/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}${queryString}`)

  if (!response.ok) {
    throw new Error(`Failed to get reactions: ${response.status}`)
  }
  return response.json()
}

/**
 * Create a thread in a channel
 */
export async function createThread(channelId: string, options: { name: string; type?: number }) {
  const response = await discordPost(`/channels/${channelId}/threads`, {
    name: options.name.substring(0, 100),
    type: options.type || 11, // Public thread
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create thread: ${error}`)
  }
  return response.json()
}

/**
 * Send a message to a channel
 */
export async function sendMessage(channelId: string, content: string) {
  const response = await discordPost(`/channels/${channelId}/messages`, {
    content: content.slice(0, 2000), // Discord message limit
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send message: ${error}`)
  }
  return response.json()
}

/**
 * Create a thread from a message
 */
export async function createThreadFromMessage(channelId: string, messageId: string, threadName: string) {
  const response = await discordPost(`/channels/${channelId}/messages/${messageId}/threads`, {
    name: threadName.slice(0, 100),
    auto_archive_duration: 10080, // 7 days
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create thread: ${error}`)
  }
  return response.json()
}

/**
 * Create a Discord thread by first posting a message, then creating a thread from it
 * This is the original helper function for compatibility
 */
export async function createDiscordThread(
  channelId: string,
  threadName: string,
  content: string,
): Promise<{ success: boolean; threadId?: string; error?: string }> {
  if (!isDiscordConfigured()) {
    console.error("DISCORD_BOT_TOKEN not configured")
    return { success: false, error: "Discord bot token not configured" }
  }

  try {
    // Create a message first
    const message = await sendMessage(channelId, content)

    // Create a thread from the message
    const thread = await createThreadFromMessage(channelId, message.id, threadName)

    return { success: true, threadId: thread.id }
  } catch (error) {
    console.error("Error creating Discord thread:", error)
    return { success: false, error: String(error) }
  }
}

/**
 * Helper to check if Discord is configured
 */
export function isDiscordConfigured(): boolean {
  return !!process.env.DISCORD_BOT_TOKEN
}
