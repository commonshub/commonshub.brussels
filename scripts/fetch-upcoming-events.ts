/**
 * CLI: Fetch upcoming events from all sources and report stats
 *
 * Usage: npx tsx scripts/fetch-upcoming-events.ts [--force]
 *
 * Fetches from:
 *   - Luma ICS feed (all events on the CHB calendar)
 *   - Google Calendar ICS (room calendars)
 *   - Luma API (if LUMA_API_KEY is set)
 *
 * Then generates events.json for each month.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FORCE = process.argv.includes("--force") ? "--force" : "";

// Fetch current month + next 2 months
const now = new Date();
const months: string[] = [];
for (let i = 0; i <= 2; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
  months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
}

const startMonth = months[0];
const endMonth = months[months.length - 1];
const monthArgs = `--start-month=${startMonth} --end-month=${endMonth}`;

console.log(`\n📅 Fetching upcoming events: ${startMonth} → ${endMonth}\n`);

// Step 1: Fetch calendars (ICS feeds)
console.log("━━━ Step 1: Fetching calendar feeds ━━━\n");
try {
  execSync(`npx tsx scripts/fetch-calendars.ts ${monthArgs} ${FORCE}`, { stdio: "inherit" });
} catch (error) {
  console.error("✗ Error fetching calendars");
  process.exit(1);
}

// Step 2: Generate events from fetched data
console.log("\n━━━ Step 2: Generating events ━━━\n");
try {
  execSync(`npx tsx scripts/generate-events.ts ${monthArgs}`, { stdio: "inherit" });
} catch (error) {
  console.error("✗ Error generating events");
  process.exit(1);
}

// Step 3: Report stats
console.log("\n━━━ Event Statistics ━━━\n");

interface EventData {
  id: string;
  name: string;
  startAt: string;
  source: string;
  calendarSource: string;
}

let totalEvents = 0;
const statsByMonth: Record<string, { total: number; bySource: Record<string, number> }> = {};

for (const month of months) {
  const [year, m] = month.split("-");
  const eventsPath = path.join(DATA_DIR, year, m, "events.json");

  if (!fs.existsSync(eventsPath)) {
    statsByMonth[month] = { total: 0, bySource: {} };
    continue;
  }

  try {
    const data = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
    const events: EventData[] = data.events || [];

    // Only count future events
    const futureEvents = events.filter((e) => new Date(e.startAt) >= now);

    const bySource: Record<string, number> = {};
    for (const event of futureEvents) {
      const src = event.calendarSource || event.source || "unknown";
      bySource[src] = (bySource[src] || 0) + 1;
    }

    statsByMonth[month] = { total: futureEvents.length, bySource };
    totalEvents += futureEvents.length;
  } catch (error) {
    statsByMonth[month] = { total: 0, bySource: {} };
  }
}

for (const [month, stats] of Object.entries(statsByMonth)) {
  const sources = Object.entries(stats.bySource)
    .map(([src, count]) => `${src}: ${count}`)
    .join(", ");
  console.log(`  ${month}: ${stats.total} events ${sources ? `(${sources})` : "(none)"}`);
}
console.log(`\n  Total upcoming: ${totalEvents} events`);

// Step 4: Regenerate events.md with upcoming events only
console.log("\n━━━ Step 3: Updating events.md ━━━\n");
try {
  execSync("npx tsx scripts/generate-md-files.ts", { stdio: "inherit" });
} catch (error) {
  console.error("✗ Error generating md files");
}

console.log("\n✓ Done!\n");
