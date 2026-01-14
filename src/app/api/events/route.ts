import { NextResponse } from "next/server";
import settings from "@/settings/settings.json";

const LUMA_API_KEY = process.env.LUMA_API_KEY;
const CALENDAR_API_ID = settings.luma.calendarId || "cal-kWlIiw3HsJFhs25";
const ICS_URL = settings.luma.icalUrl;

// Cache for 1 hour
let cachedData: {
  events: LumaEvent[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

interface LumaEvent {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  cover_url: string;
  url: string;
  location?: string;
  isExternal: boolean;
  externalPlatform?: string;
  externalUrl?: string;
  tags?: Array<{ name: string; color: string }>;
  isFeatured?: boolean;
}

async function fetchIcsEvents(): Promise<LumaEvent[]> {
  if (!ICS_URL) return [];

  try {
    const response = await fetch(ICS_URL);
    if (!response.ok) return [];

    const icsText = await response.text();
    const events: LumaEvent[] = [];

    // Parse VEVENT blocks
    const eventBlocks = icsText.split("BEGIN:VEVENT");

    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i].split("END:VEVENT")[0];

      const getField = (field: string): string => {
        const regex = new RegExp(`^${field}[^:]*:(.*)`, "m");
        const match = block.match(regex);
        return match
          ? match[1].trim().replace(/\\n/g, "\n").replace(/\\,/g, ",")
          : "";
      };

      const uid = getField("UID");
      const summary = getField("SUMMARY");
      const description = getField("DESCRIPTION");
      const dtstart = getField("DTSTART");
      const dtend = getField("DTEND");
      const url = getField("URL");
      let location = getField("LOCATION");

      // Skip if no URL or if it's a Luma event (we'll get those from the API)
      if (!url || url.includes("lu.ma")) continue;

      // Parse dates
      const parseIcsDate = (dateStr: string): string => {
        if (!dateStr) return "";
        // Format: 20241201T180000Z or 20241201
        const clean = dateStr.replace(/[TZ]/g, "");
        if (clean.length >= 8) {
          const year = clean.substring(0, 4);
          const month = clean.substring(4, 6);
          const day = clean.substring(6, 8);
          const hour = clean.length >= 10 ? clean.substring(8, 10) : "00";
          const minute = clean.length >= 12 ? clean.substring(10, 12) : "00";
          return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
        }
        return "";
      };

      const startAt = parseIcsDate(dtstart);
      const endAt = parseIcsDate(dtend);

      // Only include future events
      if (startAt && new Date(startAt) < new Date()) continue;

      // Don't show location if it contains "Commons Hub"
      if (location.toLowerCase().includes("commons hub")) {
        location = "";
      }

      // Detect external platform
      let externalPlatform = "";
      if (url.includes("eventbrite")) externalPlatform = "Eventbrite";
      else if (url.includes("meetup")) externalPlatform = "Meetup";
      else if (url.includes("facebook")) externalPlatform = "Facebook";
      else externalPlatform = "Event Page";

      events.push({
        id: uid || `ics-${i}`,
        name: summary,
        description: description.substring(0, 200),
        start_at: startAt,
        end_at: endAt,
        cover_url: "",
        url: url,
        location,
        isExternal: true,
        externalPlatform,
        externalUrl: url,
        tags: [],
        isFeatured: false,
      });
    }

    return events;
  } catch (error) {
    console.error("[v0] Failed to parse ICS events:", error);
    return [];
  }
}

async function fetchCalendarEvents(): Promise<LumaEvent[]> {
  if (!LUMA_API_KEY) {
    console.log("[v0] No LUMA_API_KEY set, cannot fetch calendar events");
    return [];
  }

  try {
    const apiUrl = `https://api.lu.ma/public/v1/calendar/list-events?calendar_api_id=${CALENDAR_API_ID}&after=${new Date().toISOString()}`;

    const response = await fetch(apiUrl, {
      headers: {
        "x-luma-api-key": LUMA_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[v0] Luma Calendar API error:",
        response.status,
        errorText
      );
      return [];
    }

    const data = await response.json();
    const entries = data.entries || [];

    return entries.map(
      (entry: {
        event: Record<string, unknown>;
        tags?: Array<{ name: string; color: string }>;
      }) => {
        const event = entry.event as {
          api_id?: string;
          name?: string;
          description?: string;
          start_at?: string;
          end_at?: string;
          cover_url?: string;
          url?: string;
          geo_address_json?: { full_address?: string };
        };
        const tags = (entry.tags || []).map(
          (t: { name: string; color: string }) => ({
            name: t.name,
            color: t.color || "#6b7280",
          })
        );

        let location = event.geo_address_json?.full_address || "";
        // Don't show location if it contains "Commons Hub"
        if (location.toLowerCase().includes("commons hub")) {
          location = "";
        }

        const isFeatured = tags.some(
          (t) => t.name.toLowerCase() === "featured"
        );

        return {
          id: event.api_id || "",
          name: event.name || "",
          description: event.description || "",
          start_at: event.start_at || "",
          end_at: event.end_at || "",
          cover_url: event.cover_url || "",
          url: event.url || "",
          location,
          isExternal: false,
          tags,
          isFeatured,
        };
      }
    );
  } catch (error) {
    console.error("[v0] Failed to fetch calendar events:", error);
    return [];
  }
}

export async function GET() {
  // Check cache
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      events: cachedData.events,
      cached: true,
      cachedAt: new Date(cachedData.timestamp).toISOString(),
    });
  }

  try {
    const [lumaEvents, icsEvents] = await Promise.all([
      fetchCalendarEvents(),
      fetchIcsEvents(),
    ]);

    // Combine and deduplicate (prefer Luma events)
    const lumaEventIds = new Set(lumaEvents.map((e) => e.id));
    const allEvents = [
      ...lumaEvents,
      ...icsEvents.filter((e) => !lumaEventIds.has(e.id)),
    ];

    // Sort by date
    const sortedEvents = allEvents.sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    // Update cache
    cachedData = {
      events: sortedEvents,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      events: sortedEvents,
      cached: false,
    });
  } catch (error) {
    console.error("[v0] Failed to fetch events:", error);

    // Return cached data if available, even if stale
    if (cachedData) {
      return NextResponse.json({
        events: cachedData.events,
        cached: true,
        stale: true,
        error: "Failed to refresh, serving stale cache",
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch events", events: [] },
      { status: 500 }
    );
  }
}
