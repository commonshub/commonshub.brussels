import { NextResponse } from "next/server"
import settings from "@/settings/settings.json"
import { getGuildMembers, isDiscordConfigured } from "@/lib/discord"
import fs from "fs"
import path from "path"

interface DiscordMember {
  user: {
    id: string
    username: string
    global_name?: string
    avatar?: string
  }
  roles: string[]
}

interface RoleMember {
  id: string
  username: string
  displayName: string
  avatar: string | null
  balance?: number
}

interface Contributor {
  id: string
  username: string
  contributionCount: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const roleId = searchParams.get("roleId")

  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 })
  }

  if (!isDiscordConfigured()) {
    return NextResponse.json({ error: "Discord bot token not configured" }, { status: 500 })
  }

  const guildId = settings.discord.guildId

  try {
    const members: DiscordMember[] = await getGuildMembers(guildId, 1000)

    // Load contributors data to get token balances
    const currentYear = new Date().getFullYear().toString()
    const contributorsPath = path.join(process.cwd(), "data", currentYear, "contributors.json")
    let contributorsMap = new Map<string, number>()

    try {
      if (fs.existsSync(contributorsPath)) {
        const contributorsData = JSON.parse(fs.readFileSync(contributorsPath, "utf-8"))
        if (contributorsData.contributors) {
          contributorsData.contributors.forEach((c: Contributor) => {
            contributorsMap.set(c.id, c.contributionCount)
          })
        }
      }
    } catch (error) {
      console.error("Error loading contributors data:", error)
    }

    // Filter members who have this role and add balance data
    const roleMembers: RoleMember[] = members
      .filter((member) => member.roles.includes(roleId))
      .map((member) => ({
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.global_name || member.user.username,
        avatar: member.user.avatar
          ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
          : null,
        balance: contributorsMap.get(member.user.id) || 0,
      }))
      .sort((a, b) => (b.balance || 0) - (a.balance || 0)) // Sort by balance DESC

    return NextResponse.json({ members: roleMembers })
  } catch (error) {
    console.error("Error fetching role members:", error)
    return NextResponse.json({ error: "Failed to fetch role members" }, { status: 500 })
  }
}
