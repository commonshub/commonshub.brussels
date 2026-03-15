#!/usr/bin/env tsx
/**
 * Generate markdown files in public/ for LLM discoverability.
 *
 * Usage:
 *   npm run generate-md
 *
 * Generates:
 *   - public/events.md - upcoming events from cached events.json
 *   - public/rooms.md - room details with ICS calendar links
 *
 * Should be run as part of the generate-data pipeline (after generate-events.ts).
 */

import * as fs from "fs";
import * as path from "path";
import settings from "../src/settings/settings.json";
import roomsData from "../src/settings/rooms.json";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const BASE_URL = "https://commonshub.brussels";
const ICS_URL = (settings as any).calendars?.google || "";

interface CachedEvent {
  id: string;
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  location?: string;
  url?: string;
}

interface EventsFile {
  month: string;
  events: CachedEvent[];
}

/**
 * Load upcoming events from locally cached events.json files.
 * Scans current and future month directories.
 */
function loadUpcomingEvents(): CachedEvent[] {
  const now = new Date();
  const events: CachedEvent[] = [];

  if (!fs.existsSync(DATA_DIR)) {
    return events;
  }

  // Scan year directories
  const yearDirs = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort();

  for (const year of yearDirs) {
    const yearPath = path.join(DATA_DIR, year);
    const monthDirs = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort();

    for (const month of monthDirs) {
      // Skip months more than 1 month in the past
      const monthDate = new Date(parseInt(year), parseInt(month), 0); // last day of month
      if (monthDate < new Date(now.getFullYear(), now.getMonth() - 1, 1)) {
        continue;
      }

      const eventsPath = path.join(yearPath, month, "events.json");
      if (!fs.existsSync(eventsPath)) continue;

      try {
        const content = fs.readFileSync(eventsPath, "utf-8");
        const data: EventsFile = JSON.parse(content);

        for (const event of data.events || []) {
          // Only include future events
          if (new Date(event.startAt) >= now) {
            events.push(event);
          }
        }
      } catch (error) {
        console.error(`  Warning: could not read ${eventsPath}:`, error);
      }
    }
  }

  // Sort by start date
  events.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  return events;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels",
  });
}

function truncateDescription(desc: string, maxLen: number = 200): string {
  if (!desc) return "";
  const clean = desc.replace(/<[^>]*>/g, "").trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen).trimEnd() + "...";
}

function generateEventsMd(opts: { quiet?: boolean } = {}) {
  if (!opts.quiet) console.log("  Loading events from cached data...");
  const allEvents = loadUpcomingEvents();
  if (!opts.quiet) console.log(`  Found ${allEvents.length} upcoming events`);

  let eventsMarkdown: string;

  if (allEvents.length === 0) {
    eventsMarkdown = `No upcoming events found. Check our [Luma calendar](https://lu.ma/commonshub) or [website](${BASE_URL}) for the latest updates.`;
  } else {
    eventsMarkdown = allEvents
      .map((event) => {
        const lines = [`### ${event.name}`];
        lines.push("");
        lines.push(`- **Date**: ${formatDate(event.startAt)}`);
        const startTime = formatTime(event.startAt);
        const endTime = event.endAt ? formatTime(event.endAt) : "";
        if (startTime) {
          lines.push(
            `- **Time**: ${startTime}${endTime ? ` - ${endTime}` : ""} (Brussels time)`
          );
        }
        if (
          event.location &&
          !event.location.toLowerCase().includes("commons hub")
        ) {
          lines.push(`- **Location**: ${event.location}`);
        } else {
          lines.push(
            `- **Location**: Commons Hub Brussels, Rue de la Madeleine 51, 1000 Brussels`
          );
        }
        if (event.url) {
          lines.push(`- **Link**: [Event page](${event.url})`);
        }
        const desc = truncateDescription(event.description || "");
        if (desc) {
          lines.push("");
          lines.push(desc);
        }
        return lines.join("\n");
      })
      .join("\n\n---\n\n");
  }

  const content = `# Upcoming Events at Commons Hub Brussels

> Events and community gatherings at Commons Hub Brussels, Rue de la Madeleine 51, 1000 Brussels.

This file is automatically generated. Last updated: ${new Date().toISOString()}

## Calendar

You can subscribe to our calendar:
- [Luma calendar](https://lu.ma/commonshub)
${ICS_URL ? `- [Google Calendar (ICS)](${ICS_URL})` : ""}

## Upcoming Events

${eventsMarkdown}

---

## Host Your Own Event

Want to host an event at Commons Hub Brussels? [Contact us](${BASE_URL}/contact) or [book a room](${BASE_URL}/rooms).
`;

  const outputPath = path.join(process.cwd(), "public", "events.md");
  fs.writeFileSync(outputPath, content, "utf-8");
  if (!opts.quiet) console.log(`  Written to ${outputPath}`);
}

function generateRoomsMd(opts: { quiet?: boolean } = {}) {
  if (!opts.quiet) console.log("  Generating rooms.md...");

  const roomsMarkdown = roomsData.rooms
    .map((room) => {
      const lines = [`### ${room.name}`];
      lines.push("");
      lines.push(room.description);
      lines.push("");
      lines.push(`- **Capacity**: Up to ${room.capacity} people`);

      if (room.pricePerHour > 0) {
        lines.push(`- **Price**: ${room.pricePerHour} EUR/hour + VAT`);
        lines.push(`- **Token price**: ${room.tokensPerHour} CHT/hour`);
      }

      if ((room as any).membershipRequired) {
        lines.push(`- **Access**: Members only`);
      }

      if (room.features && room.features.length > 0) {
        lines.push(`- **Features**: ${room.features.join(", ")}`);
      }

      if (room.idealFor && room.idealFor.length > 0) {
        lines.push(`- **Ideal for**: ${room.idealFor.join(", ")}`);
      }

      lines.push(`- **Details**: [${room.name}](${BASE_URL}/rooms/${room.slug})`);

      // Add ICS calendar link if available
      if (room.googleCalendarId) {
        lines.push(`- **Calendar (ICS)**: [${room.slug}.ics](${BASE_URL}/rooms/${room.slug}.ics)`);
      }

      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  const content = `# Rooms at Commons Hub Brussels

> Versatile spaces for events, workshops, meetings, and community gatherings at Rue de la Madeleine 51, 1000 Brussels.

This file is automatically generated. Last updated: ${new Date().toISOString()}

## Available Spaces

${roomsMarkdown}

---

## Booking

Rooms can be booked by visiting the individual room pages above and filling out the booking form. Members can also pay with Commons Hub Tokens (CHT).

For questions about bookings, contact us at hello@commonshub.brussels or visit [commonshub.brussels/contact](${BASE_URL}/contact).
`;

  const outputPath = path.join(process.cwd(), "public", "rooms.md");
  fs.writeFileSync(outputPath, content, "utf-8");
  if (!opts.quiet) console.log(`  Written to ${outputPath}`);
}

// Export functions for CLI usage
export { generateEventsMd, generateRoomsMd };

/**
 * Generate all markdown files.
 * Exported for CLI use.
 */
export function generateMarkdownFiles(opts: { quiet?: boolean } = {}): void {
  if (!opts.quiet) console.log("📝 Generating markdown files for LLM discoverability...\n");
  generateEventsMd(opts);
  generateRoomsMd(opts);
  if (!opts.quiet) console.log("\n✅ Done!");
}

function main() {
  generateMarkdownFiles();
}

// Only run main when executed directly
const isDirectRun = process.argv[1]?.includes("generate-md-files");
if (isDirectRun) {
  main();
}
