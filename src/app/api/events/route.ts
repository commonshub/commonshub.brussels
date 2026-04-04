import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";

// Cache for 5 minutes (data files are already pre-generated hourly)
let cachedData: {
  events: HomepageEvent[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface EventTag {
  name: string;
  color: string;
}

interface HomepageEvent {
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
  tags?: EventTag[];
  isFeatured?: boolean;
}

/**
 * Load upcoming events from pre-generated data files.
 * These are populated by the fetch-recent / fetch-calendars pipeline (runs hourly).
 */
function loadUpcomingEvents(): HomepageEvent[] {
  const now = new Date();
  const events: HomepageEvent[] = [];

  if (!fs.existsSync(DATA_DIR)) {
    console.log("[events] DATA_DIR not found:", DATA_DIR);
    return [];
  }

  // Scan current month + next 2 months
  for (let i = 0; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = String(d.getFullYear());
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const eventsPath = path.join(DATA_DIR, year, month, "events.json");

    if (!fs.existsSync(eventsPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(eventsPath, "utf-8");
      const data = JSON.parse(content);
      const monthEvents = data.events || [];

      for (const event of monthEvents) {
        const startAt = event.startAt || event.start_at || "";

        // Only include future events
        if (startAt && new Date(startAt) < now) continue;

        // Determine if external (non-Luma source without a lu.ma URL)
        const eventUrl = event.url || "";
        const isLuma = eventUrl.includes("lu.ma") || eventUrl.includes("luma.com");
        const isExternal = !isLuma && !!eventUrl;

        // Detect external platform
        let externalPlatform = "";
        if (isExternal) {
          if (eventUrl.includes("eventbrite")) externalPlatform = "Eventbrite";
          else if (eventUrl.includes("meetup")) externalPlatform = "Meetup";
          else if (eventUrl.includes("facebook")) externalPlatform = "Facebook";
          else externalPlatform = "Event Page";
        }

        // Normalize location — hide "Commons Hub" since it's implied
        let location = event.location || "";
        if (location.toLowerCase().includes("commons hub")) {
          location = "";
        }

        // Get tags from event or from nested lumaData
        const tags: EventTag[] = event.tags || (event.lumaData?.tags
          ? (event.lumaData.tags as any[]).map((t: any) =>
              typeof t === "string" ? { name: t, color: "#6b7280" } : { name: t.name, color: t.color || "#6b7280" }
            )
          : []);

        const isFeatured = tags.some(
          (t) => t.name.toLowerCase() === "featured"
        );

        events.push({
          id: event.id || "",
          name: event.name || "",
          description: event.description || "",
          start_at: startAt,
          end_at: event.endAt || event.end_at || "",
          cover_url: event.coverImage || event.cover_url || "",
          url: eventUrl,
          location,
          isExternal,
          externalPlatform: isExternal ? externalPlatform : undefined,
          externalUrl: isExternal ? eventUrl : undefined,
          tags,
          isFeatured,
        });
      }
    } catch (error) {
      console.error(`[events] Error reading ${eventsPath}:`, error);
    }
  }

  // Sort by date
  events.sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  return events;
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
    const events = loadUpcomingEvents();

    // Update cache
    cachedData = {
      events,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      events,
      cached: false,
    });
  } catch (error) {
    console.error("[events] Failed to load events:", error);

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
      { error: "Failed to load events", events: [] },
      { status: 500 }
    );
  }
}
