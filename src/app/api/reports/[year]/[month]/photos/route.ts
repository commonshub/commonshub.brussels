import { NextRequest, NextResponse } from "next/server";
import { readDiscordMessages, getAllPhotos, getActiveMembers } from "@/lib/reports";

export const revalidate = 86400; // 24 hours

interface RouteContext {
  params: Promise<{
    year: string;
    month: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { year, month } = await context.params;

    // Validate year and month format
    if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid year or month format" },
        { status: 400 }
      );
    }

    // Get all Discord messages for the month
    const messages = readDiscordMessages(year, month);

    // Get all photos in chronological order (use relative URLs)
    const photos = getAllPhotos(messages, { relative: true });

    // Get active members for userMap
    const activeMembers = getActiveMembers(messages);

    return NextResponse.json({
      year,
      month,
      photos,
      activeMembers,
    });
  } catch (error) {
    console.error("Error generating monthly photo gallery:", error);
    return NextResponse.json(
      { error: "Failed to generate photo gallery" },
      { status: 500 }
    );
  }
}
