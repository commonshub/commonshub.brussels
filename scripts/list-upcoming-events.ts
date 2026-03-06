/**
 * CLI: List upcoming events from cached data
 *
 * Usage: npx tsx scripts/list-upcoming-events.ts [--all] [--json]
 *
 * Options:
 *   --all   Show all events (including past)
 *   --json  Output as JSON
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const showAll = process.argv.includes("--all");
const asJson = process.argv.includes("--json");

interface EventData {
  id: string;
  name: string;
  startAt: string;
  endAt?: string;
  location?: string;
  url?: string;
  source: string;
  calendarSource?: string;
  coverImage?: string;
}

function loadAllEvents(): EventData[] {
  const events: EventData[] = [];

  if (!fs.existsSync(DATA_DIR)) {
    return events;
  }

  const yearDirs = fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort();

  for (const year of yearDirs) {
    const yearPath = path.join(DATA_DIR, year);
    const monthDirs = fs.readdirSync(yearPath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{2}$/.test(d.name))
      .map((d) => d.name)
      .sort();

    for (const month of monthDirs) {
      const eventsPath = path.join(yearPath, month, "events.json");
      if (!fs.existsSync(eventsPath)) continue;

      try {
        const data = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
        events.push(...(data.events || []));
      } catch {
        // skip
      }
    }
  }

  events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return events;
}

const now = new Date();
let events = loadAllEvents();

if (!showAll) {
  events = events.filter((e) => new Date(e.startAt) >= now);
}

if (events.length === 0) {
  console.log("No upcoming events found. Run `npx tsx scripts/fetch-upcoming-events.ts` to fetch.");
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify(events, null, 2));
  process.exit(0);
}

console.log(`\n📅 ${showAll ? "All" : "Upcoming"} Events (${events.length})\n`);

let currentMonth = "";
for (const event of events) {
  const date = new Date(event.startAt);
  const monthLabel = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });

  if (monthLabel !== currentMonth) {
    currentMonth = monthLabel;
    console.log(`\n── ${monthLabel} ──`);
  }

  const day = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Brussels",
  });
  const source = event.calendarSource || event.source || "?";
  const isPast = date < now;

  console.log(
    `  ${isPast ? "⊘" : "•"} ${day} ${time}  ${event.name}  [${source}]${event.url ? `  ${event.url}` : ""}`
  );
}

console.log("");
