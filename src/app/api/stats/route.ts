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
    const response = await fetch(settings.luma.icalUrl)
    if (!response.ok) return 0

    const icsText = await response.text()

    const now = new Date()
    const threeMonthsFromNow = new Date()
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

    // Parse events and filter by date
    const eventBlocks = icsText.split("BEGIN:VEVENT")
    let count = 0

    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i]
      const dtStartMatch = block.match(/DTSTART(?:;[^:]*)?:(\d{8}T?\d{0,6}Z?)/)

      if (dtStartMatch) {
        const dateStr = dtStartMatch[1]
        let eventDate: Date

        if (dateStr.includes("T")) {
          // DateTime format: 20241215T180000Z
          const year = Number.parseInt(dateStr.substring(0, 4))
          const month = Number.parseInt(dateStr.substring(4, 6)) - 1
          const day = Number.parseInt(dateStr.substring(6, 8))
          const hour = Number.parseInt(dateStr.substring(9, 11)) || 0
          const minute = Number.parseInt(dateStr.substring(11, 13)) || 0
          eventDate = new Date(Date.UTC(year, month, day, hour, minute))
        } else {
          // Date only format: 20241215
          const year = Number.parseInt(dateStr.substring(0, 4))
          const month = Number.parseInt(dateStr.substring(4, 6)) - 1
          const day = Number.parseInt(dateStr.substring(6, 8))
          eventDate = new Date(year, month, day)
        }

        if (eventDate >= now && eventDate <= threeMonthsFromNow) {
          count++
        }
      }
    }

    return count
  } catch (error) {
    console.error("[v0] Error fetching event count:", error)
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
