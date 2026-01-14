import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getUserFavorites, isFavorited } from "@/lib/favorites"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.discordId
    const searchParams = request.nextUrl.searchParams
    const messageId = searchParams.get("messageId")

    // If messageId is provided, check if that specific message is favorited
    if (messageId) {
      const favorited = isFavorited(userId, messageId)
      return NextResponse.json({ favorited, messageId })
    }

    // Otherwise, return all favorites for this user
    const favorites = getUserFavorites(userId)
    return NextResponse.json({
      favorites: favorites.map((fav) => ({
        messageId: fav.messageId,
        channelId: fav.channelId,
        addedAt: fav.addedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Error fetching favorites:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
