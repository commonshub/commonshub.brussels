import { type HomepageEvent } from "@/lib/hosted-events";
import { loadUpcomingEvents } from "@/lib/upcoming-events";
import { applyHandManagedEvents } from "@/lib/pinned-events";
import { NextResponse } from "next/server";
import {
  EMPTY_CACHE_SECONDS,
  FULL_CACHE_SECONDS,
  dataCacheHeaders,
} from "@/lib/data-route";

// Read the dataset at request time. Prerendering this baked an empty
// {"events":[]} into the image and served it after every deploy.
export const dynamic = "force-dynamic";

// Cache for 5 minutes (data files are already pre-generated hourly), but hold
// on to an empty result for seconds only — it usually means the dataset was
// not readable yet, and that should not survive on the homepage.
let cachedData: {
  events: HomepageEvent[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = FULL_CACHE_SECONDS * 1000;
const EMPTY_CACHE_DURATION = EMPTY_CACHE_SECONDS * 1000;

function cacheDurationFor(events: HomepageEvent[]): number {
  return events.length > 0 ? CACHE_DURATION : EMPTY_CACHE_DURATION;
}

export async function GET() {
  // Serve from cache, which expires quickly when it holds nothing.
  if (
    cachedData &&
    Date.now() - cachedData.timestamp < cacheDurationFor(cachedData.events)
  ) {
    return NextResponse.json(
      {
        events: cachedData.events,
        cached: true,
        cachedAt: new Date(cachedData.timestamp).toISOString(),
      },
      { headers: dataCacheHeaders(cachedData.events.length > 0) }
    );
  }

  try {
    const events = applyHandManagedEvents(loadUpcomingEvents());

    cachedData = {
      events,
      timestamp: Date.now(),
    };

    return NextResponse.json(
      { events, cached: false },
      { headers: dataCacheHeaders(events.length > 0) }
    );
  } catch (error) {
    console.error("[events] Failed to load events:", error);

    // Prefer stale events over none, but do not let a failure be cached.
    if (cachedData && cachedData.events.length > 0) {
      return NextResponse.json(
        {
          events: cachedData.events,
          cached: true,
          stale: true,
          error: "Failed to refresh, serving stale cache",
        },
        { headers: dataCacheHeaders(false) }
      );
    }

    return NextResponse.json(
      { error: "Failed to load events", events: [] },
      { status: 500, headers: dataCacheHeaders(false) }
    );
  }
}
