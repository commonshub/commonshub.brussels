import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import partners from "@/settings/partners.json"
import { getGuild, isDiscordConfigured } from "@/lib/discord"
import { DATA_DIR } from "@/lib/data-paths"

const GUILD_ID = "1280532848604086365"

// Cache for 1 hour to align with generated data refresh cadence.
let cache: { data: any; timestamp: number } | null = null
const CACHE_DURATION = 60 * 60 * 1000

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
    const eventsPath = path.join(DATA_DIR, "latest", "generated", "events.json")
    if (!fs.existsSync(eventsPath)) return 0

    const data = JSON.parse(fs.readFileSync(eventsPath, "utf-8"))
    const events = Array.isArray(data.events) ? data.events : []

    const now = new Date()
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

    // Count upcoming events within the next 3 months
    const upcomingEvents = events.filter((event: any) => {
      const eventDate = new Date(event.startAt || event.start_at)
      if (Number.isNaN(eventDate.getTime())) return false
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
