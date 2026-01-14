import { NextResponse } from "next/server"
import settings from "@/settings/settings.json"
import partners from "@/settings/partners.json"
import { getGuild, isDiscordConfigured } from "@/lib/discord"

const GUILD_ID = "1280532848604086365"

// Cache for 24 hours
let cache: { data: any; timestamp: number } | null = null
const CACHE_DURATION = 24 * 60 * 60 * 1000

async function fetchDiscordMemberCount(): Promise<number> {
  if (!isDiscordConfigured()) return 0

  try {
    const data = await getGuild(GUILD_ID)
    return data.approximate_member_count || 0
  } catch (error) {
    console.error("[v0] Error fetching Discord member count:", error)
    return 0
  }
}

async function fetchEventCount(): Promise<number> {
  try {
    // Use the events API endpoint which consolidates all event sources
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/events`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    })

    if (!response.ok) return 0

    const data = await response.json()
    const events = data.events || []

    const now = new Date()
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

    // Count upcoming events within the next 3 months
    const upcomingEvents = events.filter((event: any) => {
      const eventDate = new Date(event.start_at)
      return eventDate >= now && eventDate <= threeMonthsFromNow
    })

    return upcomingEvents.length
  } catch (error) {
    console.error("[stats] Error fetching event count:", error)
    return 0
  }
}

export async function GET() {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return NextResponse.json(cache.data)
  }

  const [discordMembers, eventCount] = await Promise.all([fetchDiscordMemberCount(), fetchEventCount()])

  const stats = {
    events: eventCount,
    communityMembers: discordMembers,
    partnerOrganizations: partners.length,
    commonSpaces: 1,
  }

  // Update cache
  cache = { data: stats, timestamp: Date.now() }

  return NextResponse.json(stats)
}
