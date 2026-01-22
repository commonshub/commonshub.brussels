import { NextRequest, NextResponse } from "next/server";
import {
  getAvailableMonths,
  readDiscordMessages,
  getAllPhotos,
  getActiveMembers,
  filterVisiblePhotos,
  type UserSession,
} from "@/lib/reports";
import { auth } from "@/auth";

export const revalidate = 86400; // 24 hours

interface RouteContext {
  params: Promise<{
    year: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { year } = await context.params;

    // Validate year format
    if (!/^\d{4}$/.test(year)) {
      return NextResponse.json(
        { error: "Invalid year format" },
        { status: 400 }
      );
    }

    // Get user session for filtering
    const session = await auth();
    const userSession: UserSession | null = session?.user
      ? {
          userId: session.user.discordId,
          roles: session.user.roles || [],
        }
      : null;

    // Get all available months for this year
    const months = getAvailableMonths(year);

    if (months.length === 0) {
      return NextResponse.json(
        { error: "No data available for this year" },
        { status: 404 }
      );
    }

    // Collect all messages from all months
    const allMessages = months.flatMap((month) => readDiscordMessages(year, month));

    // Get all photos in chronological order (use relative URLs)
    const allPhotos = getAllPhotos(allMessages, { relative: true });

    // Filter photos based on user session and visibility rules
    const photos = filterVisiblePhotos(allPhotos, allMessages, userSession);

    // Get active members for userMap
    const activeMembers = getActiveMembers(allMessages);

    return NextResponse.json({
      year,
      photos,
      activeMembers,
    });
  } catch (error) {
    console.error("Error generating yearly photo gallery:", error);
    return NextResponse.json(
      { error: "Failed to generate photo gallery" },
      { status: 500 }
    );
  }
}
