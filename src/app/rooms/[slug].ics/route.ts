import { redirect, notFound } from "next/navigation";
import roomsData from "@/settings/rooms.json";

/**
 * Redirect /rooms/:slug.ics to the Google Calendar ICS feed for the room.
 *
 * Example: /rooms/ostrom.ics → Google Calendar ICS
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Remove .ics extension if present (Next.js route already stripped it)
  const roomSlug = slug.replace(/\.ics$/, "");

  const room = roomsData.rooms.find((r) => r.slug === roomSlug);

  if (!room) {
    notFound();
  }

  if (!room.googleCalendarId) {
    // Room doesn't have a calendar
    notFound();
  }

  // Google Calendar ICS export URL format
  const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(room.googleCalendarId)}/public/basic.ics`;

  redirect(icsUrl);
}
