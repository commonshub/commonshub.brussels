/**
 * The public events still to come, as the homepage, /events and the applicants' emails list them:
 * the upcoming events file (chb, hourly) and the month files ahead, without private room
 * bookings, hosted events linked to their own page, sorted by date.
 */

import * as fs from "fs";
import * as path from "path";

import { tierDir } from "@/lib/data-paths";
import { readEventsForMonth } from "@/lib/dataset";
import { coverUrlFor } from "@/lib/event-cover";
import { mergeHostedEvents, type EventTag, type HomepageEvent } from "@/lib/hosted-events";
import { htmlToPlainText, redactContactDetails } from "@/lib/plain-text";
import { isPublicEvent, unwrapGoogleRedirect } from "@/lib/public-events";

/** The month files from this month to the one `days` ahead: chb's upcoming file only goes so far. */
function monthEvents(now: Date, days: number): unknown[] {
  const out: unknown[] = [];
  const until = new Date(now.getTime() + days * 86_400_000);
  for (let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); d <= until; d.setUTCMonth(d.getUTCMonth() + 1))
    out.push(...readEventsForMonth("public", String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, "0")));
  return out;
}

/**
 * The events from now on: the upcoming events file (populated by the chb CLI pipeline, hourly),
 * and with aheadDays, the month files up to that many days ahead too.
 */
export function loadUpcomingEvents(now: Date = new Date(), aheadDays = 0): HomepageEvent[] {
  const eventsPath = path.join(tierDir("public"), "events.json");

  if (!fs.existsSync(eventsPath)) {
    console.log("[events] Events file not found:", eventsPath);
    return [];
  }

  try {
    const content = fs.readFileSync(eventsPath, "utf-8");
    const data = JSON.parse(content);
    const allEvents = [...(data.events || []), ...(aheadDays ? monthEvents(now, aheadDays) : [])] as any[];
    const seen = new Set<string>();
    const events: HomepageEvent[] = [];

    for (const event of allEvents) {
      const startAt = event.startAt || event.start_at || "";

      // Only include future events
      if (startAt && new Date(startAt) < now) continue;

      // The same event in the upcoming file and its month file.
      const key = event.id || `${event.name}|${startAt}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // A room-calendar entry with no event page is a private booking.
      if (!isPublicEvent(event)) continue;

      // Determine if external (non-Luma source without a lu.ma URL)
      const eventUrl = unwrapGoogleRedirect(event.url || "");
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

      // chb's local copy when the proxy will serve it, else the platform's
      // own cover, else nothing: never a URL that renders as a broken image.
      const coverUrl = coverUrlFor(event);

      events.push({
        id: event.id || "",
        name: event.name || "",
        description: redactContactDetails(htmlToPlainText(event.description || "")),
        start_at: startAt,
        end_at: event.endAt || event.end_at || "",
        cover_url: coverUrl,
        url: eventUrl,
        location,
        isExternal,
        externalPlatform: isExternal ? externalPlatform : undefined,
        externalUrl: isExternal ? eventUrl : undefined,
        tags,
        isFeatured,
      });
    }

    // Link hosted events to their own page, sorted by date
    return mergeHostedEvents(events, now);
  } catch (error) {
    console.error(`[events] Error reading ${eventsPath}:`, error);
    return [];
  }
}
