import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { addFavorite, removeFavorite } from "@/lib/favorites"
import settings from "@/settings/settings.json"

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    console.log("[Discord Reactions] Session:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.discordId,
      roles: session?.user?.roles,
    })

    if (!session || !session.user) {
      console.error("[Discord Reactions] No session or user found")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user has "Member" role
    const memberRoleId = settings.discord.roles.member
    const userRoles = session.user.roles || []
    const hasMemberRole = userRoles.includes(memberRoleId)

    if (!hasMemberRole) {
      console.error("[Discord Reactions] User does not have Member role:", {
        userId: session.user.discordId,
        userRoles,
        requiredRole: memberRoleId,
      })
      return NextResponse.json(
        { error: "Only members can favorite photos" },
        { status: 403 }
      )
    }

    console.log("[Discord Reactions] User has Member role, proceeding...")

    const botToken = process.env.DISCORD_BOT_TOKEN
    if (!botToken) {
      console.error("[Discord Reactions] Bot token not configured")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { channelId, messageId, emoji, add } = body

    // Validate required fields
    if (!channelId || !messageId || !emoji || typeof add !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: channelId, messageId, emoji, add" },
        { status: 400 }
      )
    }

    // Encode emoji for URL (Discord expects URL-encoded emoji)
    const encodedEmoji = encodeURIComponent(emoji)

    // Track the favorite in our system
    const userId = session.user.discordId
    if (add) {
      addFavorite(userId, channelId, messageId)
      console.log("[Discord Reactions] Added favorite for user:", userId)
    } else {
      removeFavorite(userId, messageId)
      console.log("[Discord Reactions] Removed favorite for user:", userId)
    }

    // Call Discord API using the bot token
    const discordUrl = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`

    console.log("[Discord Reactions] Calling Discord API:", {
      method: add ? "PUT" : "DELETE",
      url: discordUrl,
      emoji: emoji,
      encodedEmoji: encodedEmoji,
      user: session.user.username,
    })

    const discordResponse = await fetch(discordUrl, {
      method: add ? "PUT" : "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Length": "0",
      },
    })

    console.log("[Discord Reactions] Discord API response:", {
      status: discordResponse.status,
      statusText: discordResponse.statusText,
      ok: discordResponse.ok,
    })

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text()
      console.error(`[Discord Reactions] Discord API error (${discordResponse.status}):`, errorText)

      // Parse the error to provide more helpful messages
      let errorMessage = `Failed to ${add ? "add" : "remove"} reaction`
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.message) {
          errorMessage += `: ${errorData.message}`
        }
      } catch (e) {
        // Ignore parse errors
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: discordResponse.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error handling reaction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
