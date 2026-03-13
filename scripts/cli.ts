#!/usr/bin/env tsx
/**
 * chb — CLI tool for Commons Hub Brussels
 *
 * Usage:
 *   chb events [-n 10] [--since YYYYMMDD] [--skip 10]
 *   chb events sync [--since YYYYMMDD] [--force] [--history]
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const TIMEZONE = "Europe/Brussels";

// ── Arg parsing ────────────────────────────────────────────────────────────

function getFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function getOption(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  // Also support --flag=value
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  return null;
}

function getNumberOption(
  args: string[],
  flag: string,
  defaultVal: number
): number {
  const val = getOption(args, flag);
  return val ? parseInt(val, 10) : defaultVal;
}

// ── Event loading ──────────────────────────────────────────────────────────

interface EventEntry {
  id: string;
  name: string;
  startAt: string;
  endAt?: string;
  url?: string;
  source: string;
  calendarSource?: string;
  tags?: Array<{ name: string; color?: string }>;
}

function loadAllEvents(): EventEntry[] {
  const events: EventEntry[] = [];
  if (!fs.existsSync(DATA_DIR)) return events;

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
      const eventsPath = path.join(yearPath, month, "events.json");
      if (!fs.existsSync(eventsPath)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
        events.push(...(data.events || []));
      } catch {
        // skip corrupt files
      }
    }
  }

  events.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  return events;
}

// ── Table formatting ───────────────────────────────────────────────────────

function formatDateBrussels(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  });
}

function formatTimeBrussels(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  });
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
}

function printEventsTable(events: EventEntry[]): void {
  if (events.length === 0) {
    console.log("No events found.");
    return;
  }

  // Calculate column widths
  const rows = events.map((e) => ({
    date: formatDateBrussels(e.startAt),
    time: formatTimeBrussels(e.startAt),
    title: e.name,
    tags: e.tags?.map((t) => t.name).join(", ") || "",
    url: e.url || "",
  }));

  const maxTitle = Math.min(
    50,
    Math.max(5, ...rows.map((r) => r.title.length))
  );
  const maxTags = Math.min(
    30,
    Math.max(4, ...rows.map((r) => r.tags.length))
  );

  // Header
  console.log(
    `${padRight("DATE", 20)} ${padRight("TIME", 6)} ${padRight("TITLE", maxTitle)} ${padRight("TAGS", maxTags)} URL`
  );
  console.log(
    `${"-".repeat(20)} ${"-".repeat(6)} ${"-".repeat(maxTitle)} ${"-".repeat(maxTags)} ${"─".repeat(30)}`
  );

  for (const row of rows) {
    console.log(
      `${padRight(row.date, 20)} ${padRight(row.time, 6)} ${padRight(row.title, maxTitle)} ${padRight(row.tags, maxTags)} ${row.url}`
    );
  }
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdEventsList(args: string[]): Promise<void> {
  const n = getNumberOption(args, "-n", 10);
  const skip = getNumberOption(args, "--skip", 0);
  const sinceStr = getOption(args, "--since");

  let sinceDate: Date;
  if (sinceStr) {
    // Parse YYYYMMDD
    const y = sinceStr.substring(0, 4);
    const m = sinceStr.substring(4, 6);
    const d = sinceStr.substring(6, 8);
    sinceDate = new Date(`${y}-${m}-${d}T00:00:00`);
  } else {
    sinceDate = new Date();
  }

  const allEvents = loadAllEvents();
  const filtered = allEvents.filter(
    (e) => new Date(e.startAt) >= sinceDate
  );
  const sliced = filtered.slice(skip, skip + n);

  console.log(
    `\n📅 Events (${sliced.length} of ${filtered.length} total)\n`
  );
  printEventsTable(sliced);
  console.log("");
}

async function cmdEventsSync(args: string[]): Promise<void> {
  const force = getFlag(args, "--force");
  const history = getFlag(args, "--history");
  const sinceStr = getOption(args, "--since");

  let startMonth: string | null = null;
  let endMonth: string | null = null;

  if (history) {
    // Fetch everything — no month filtering
    console.log("📅 Syncing ALL event history...\n");
  } else {
    // Default: current month - 1 to current month + 2
    const now = new Date();

    if (sinceStr) {
      const y = sinceStr.substring(0, 4);
      const m = sinceStr.substring(4, 6);
      startMonth = `${y}-${m}`;
    } else {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    }

    const future = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    endMonth = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}`;

    console.log(`📅 Syncing events: ${startMonth} → ${endMonth}\n`);
  }

  // Step 1: Fetch calendars
  console.log("━━━ Step 1: Fetching calendar feeds ━━━\n");
  const fetchCalendarsMod = await import("./fetch-calendars");
  const { fetchCalendars } = fetchCalendarsMod.default || fetchCalendarsMod;
  const affectedMonths = await fetchCalendars({
    forceFetch: force,
    startMonth: startMonth,
    endMonth: endMonth,
  });

  // Step 2: Generate events.json for affected months
  console.log("\n━━━ Step 2: Generating events ━━━\n");
  const generateEventsMod = await import("./generate-events");
  const { generateEvents } = generateEventsMod.default || generateEventsMod;

  if (history) {
    // Process all months
    await generateEvents();
  } else {
    // Only process affected months
    const monthObjs = affectedMonths.map((ym: string) => {
      const [year, month] = ym.split("-");
      return { year, month };
    });
    await generateEvents({ months: monthObjs });
  }

  // Step 3: Generate markdown files
  console.log("\n━━━ Step 3: Updating markdown files ━━━\n");
  const generateMdMod = await import("./generate-md-files");
  const { generateMarkdownFiles } = generateMdMod.default || generateMdMod;
  generateMarkdownFiles();

  // Step 4: Print stats
  console.log("\n━━━ Event Statistics ━━━\n");
  const now = new Date();
  const allEvents = loadAllEvents();
  const futureEvents = allEvents.filter((e) => new Date(e.startAt) >= now);

  // Group by month
  const byMonth = new Map<string, EventEntry[]>();
  for (const e of futureEvents) {
    const d = new Date(e.startAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }

  // Group by source
  const bySource = new Map<string, number>();
  for (const e of futureEvents) {
    const src = e.calendarSource || e.source || "unknown";
    bySource.set(src, (bySource.get(src) || 0) + 1);
  }

  for (const [month, events] of [...byMonth.entries()].sort()) {
    const sources: Record<string, number> = {};
    for (const e of events) {
      const src = e.calendarSource || e.source || "unknown";
      sources[src] = (sources[src] || 0) + 1;
    }
    const srcStr = Object.entries(sources)
      .map(([s, c]) => `${s}: ${c}`)
      .join(", ");
    console.log(`  ${month}: ${events.length} events (${srcStr})`);
  }

  console.log(`\n  Total upcoming: ${futureEvents.length} events`);
  const srcSummary = [...bySource.entries()]
    .map(([s, c]) => `${s}: ${c}`)
    .join(", ");
  if (srcSummary) {
    console.log(`  By source: ${srcSummary}`);
  }

  console.log("\n✓ Sync complete!\n");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  if (!command) {
    printUsage();
    process.exit(0);
  }

  if (command === "events") {
    if (subcommand === "sync") {
      await cmdEventsSync(args.slice(2));
    } else {
      await cmdEventsList(args.slice(1));
    }
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
chb — Commons Hub Brussels CLI

Usage:
  chb events [-n 10] [--since YYYYMMDD] [--skip 10]   List upcoming events
  chb events sync [--since YYYYMMDD] [--force]         Sync events from feeds
  chb events sync --history                            Sync entire event history
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
