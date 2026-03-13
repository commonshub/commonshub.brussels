#!/usr/bin/env bun
/**
 * chb — CLI tool for Commons Hub Brussels data management
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const TIMEZONE = "Europe/Brussels";
const VERSION = "1.0.0";

// ── Colors (ANSI) ──────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const noColor = !process.stdout.isTTY || process.env.NO_COLOR;
const fmt = noColor
  ? Object.fromEntries(Object.keys(c).map((k) => [k, ""])) as typeof c
  : c;

// ── Arg parsing ────────────────────────────────────────────────────────────

function getFlag(args: string[], ...flags: string[]): boolean {
  return flags.some((f) => args.includes(f));
}

function getOption(args: string[], ...flags: string[]): string | null {
  for (const flag of flags) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    const eq = args.find((a) => a.startsWith(`${flag}=`));
    if (eq) return eq.split("=").slice(1).join("=");
  }
  return null;
}

function getNumber(args: string[], flags: string[], defaultVal: number): number {
  const val = getOption(args, ...flags);
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  return isNaN(n) ? defaultVal : n;
}

function parseSinceDate(str: string | null): Date | null {
  if (!str) return null;
  const clean = str.replace(/-/g, "");
  if (clean.length !== 8) return null;
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00`);
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

// ── Formatting ─────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: TIMEZONE,
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  });
}

function pad(str: string, len: number): string {
  if (str.length >= len) return str.substring(0, len);
  return str + " ".repeat(len - str.length);
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.substring(0, len - 1) + "…";
}

// ── Help ───────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${fmt.bold}chb${fmt.reset} ${fmt.dim}v${VERSION}${fmt.reset} — Commons Hub Brussels CLI

${fmt.bold}USAGE${fmt.reset}
  ${fmt.cyan}chb${fmt.reset} <command> [options]

${fmt.bold}COMMANDS${fmt.reset}
  ${fmt.cyan}events${fmt.reset}              List upcoming events
  ${fmt.cyan}events sync${fmt.reset}         Fetch & generate events from Luma + ICS feeds
  ${fmt.cyan}help${fmt.reset}                Show this help

${fmt.bold}OPTIONS${fmt.reset}
  ${fmt.yellow}--help, -h${fmt.reset}          Show help for a command
  ${fmt.yellow}--version, -v${fmt.reset}       Show version

${fmt.bold}EXAMPLES${fmt.reset}
  ${fmt.dim}$ chb events                          # next 10 upcoming events
  $ chb events -n 20                     # next 20 events
  $ chb events --since 20260301          # events from March 2026
  $ chb events sync                      # sync recent events
  $ chb events sync --force              # re-fetch even if cached
  $ chb events sync --history            # rebuild entire history${fmt.reset}

${fmt.bold}ENVIRONMENT${fmt.reset}
  ${fmt.yellow}DATA_DIR${fmt.reset}            Data directory (default: ./data)
  ${fmt.yellow}LUMA_API_KEY${fmt.reset}        Luma API key (enables rich event data)
`);
}

function printEventsHelp() {
  console.log(`
${fmt.bold}chb events${fmt.reset} — List events from the local data directory

${fmt.bold}USAGE${fmt.reset}
  ${fmt.cyan}chb events${fmt.reset} [options]

${fmt.bold}OPTIONS${fmt.reset}
  ${fmt.yellow}-n${fmt.reset} <count>           Number of events to show (default: 10)
  ${fmt.yellow}--since${fmt.reset} <YYYYMMDD>   Only events starting after this date (default: today)
  ${fmt.yellow}--skip${fmt.reset} <count>       Skip first N events
  ${fmt.yellow}--all${fmt.reset}                Show all events (no date filter)
  ${fmt.yellow}--help, -h${fmt.reset}           Show this help

${fmt.bold}EXAMPLES${fmt.reset}
  ${fmt.dim}$ chb events                          # next 10 upcoming
  $ chb events -n 5                      # next 5
  $ chb events --since 20260401 -n 20    # 20 events from April
  $ chb events --all --skip 10 -n 10     # page through all events${fmt.reset}
`);
}

function printSyncHelp() {
  console.log(`
${fmt.bold}chb events sync${fmt.reset} — Fetch events from feeds and regenerate data

${fmt.bold}USAGE${fmt.reset}
  ${fmt.cyan}chb events sync${fmt.reset} [options]

${fmt.bold}OPTIONS${fmt.reset}
  ${fmt.yellow}--since${fmt.reset} <YYYYMMDD>   Start syncing from this date (default: last month)
  ${fmt.yellow}--force${fmt.reset}              Re-fetch even if cached data exists
  ${fmt.yellow}--history${fmt.reset}            Rebuild entire event history
  ${fmt.yellow}--help, -h${fmt.reset}           Show this help

${fmt.bold}SOURCES${fmt.reset}
  • Luma ICS feed (all calendar events)
  • Google Calendar ICS (room bookings)
  • Luma API (rich data: covers, guests, tags — requires LUMA_API_KEY)

${fmt.bold}EXAMPLES${fmt.reset}
  ${fmt.dim}$ chb events sync                     # sync recent months
  $ chb events sync --force              # re-fetch everything
  $ chb events sync --since 20260101     # from January 2026
  $ chb events sync --history            # full rebuild${fmt.reset}
`);
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdEventsList(args: string[]): Promise<void> {
  if (getFlag(args, "--help", "-h")) {
    printEventsHelp();
    return;
  }

  const n = getNumber(args, ["-n"], 10);
  const skip = getNumber(args, ["--skip"], 0);
  const showAll = getFlag(args, "--all");
  const sinceDate = parseSinceDate(getOption(args, "--since")) || (showAll ? new Date(0) : new Date());

  const allEvents = loadAllEvents();
  const filtered = allEvents.filter((e) => new Date(e.startAt) >= sinceDate);
  const sliced = filtered.slice(skip, skip + n);

  if (sliced.length === 0) {
    console.log(`\n${fmt.dim}No events found.${fmt.reset}\n`);
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`${fmt.yellow}DATA_DIR not found:${fmt.reset} ${DATA_DIR}`);
      console.log(`${fmt.dim}Run 'chb events sync' to fetch events.${fmt.reset}\n`);
    }
    return;
  }

  // Build rows
  const rows = sliced.map((e) => ({
    date: fmtDate(e.startAt),
    time: fmtTime(e.startAt),
    title: e.name,
    tags: e.tags?.map((t) => t.name).join(", ") || "",
    url: e.url || "",
  }));

  const maxTitle = Math.min(45, Math.max(5, ...rows.map((r) => r.title.length)));
  const maxTags = Math.min(25, Math.max(4, ...rows.map((r) => r.tags.length)));

  console.log(
    `\n${fmt.bold}📅 Events${fmt.reset} ${fmt.dim}(${sliced.length} of ${filtered.length}${skip > 0 ? `, skip ${skip}` : ""})${fmt.reset}\n`
  );

  // Header
  console.log(
    `${fmt.dim}${pad("DATE", 16)} ${pad("TIME", 6)} ${pad("TITLE", maxTitle)} ${pad("TAGS", maxTags)} URL${fmt.reset}`
  );

  for (const row of rows) {
    const tagsStr = row.tags ? `${fmt.dim}${truncate(row.tags, maxTags)}${fmt.reset}` : "";
    console.log(
      `${fmt.green}${pad(row.date, 16)}${fmt.reset} ${fmt.cyan}${pad(row.time, 6)}${fmt.reset} ${pad(truncate(row.title, maxTitle), maxTitle)} ${pad(tagsStr, maxTags + fmt.dim.length + fmt.reset.length)} ${fmt.dim}${row.url}${fmt.reset}`
    );
  }

  if (filtered.length > skip + n) {
    console.log(
      `\n${fmt.dim}… ${filtered.length - skip - n} more. Use -n or --skip to paginate.${fmt.reset}`
    );
  }
  console.log("");
}

async function cmdEventsSync(args: string[]): Promise<void> {
  if (getFlag(args, "--help", "-h")) {
    printSyncHelp();
    return;
  }

  const force = getFlag(args, "--force");
  const history = getFlag(args, "--history");
  const sinceStr = getOption(args, "--since");

  let startMonth: string | null = null;
  let endMonth: string | null = null;

  if (history) {
    console.log(`\n${fmt.bold}📅 Syncing ALL event history${fmt.reset} ${fmt.dim}(this may take a while)${fmt.reset}\n`);
  } else {
    const now = new Date();

    if (sinceStr) {
      const d = parseSinceDate(sinceStr);
      if (d) {
        startMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    if (!startMonth) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    }

    const future = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    endMonth = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}`;

    console.log(`\n${fmt.bold}📅 Syncing events${fmt.reset} ${fmt.dim}${startMonth} → ${endMonth}${fmt.reset}\n`);
  }

  // Step 1: Fetch calendars
  console.log(`${fmt.bold}━━━ Fetching calendar feeds ━━━${fmt.reset}\n`);
  const { fetchCalendars } = await import("./fetch-calendars.js");
  const affectedMonths = await fetchCalendars({
    forceFetch: force,
    startMonth,
    endMonth,
  });

  // Step 2: Generate events.json
  console.log(`\n${fmt.bold}━━━ Generating events ━━━${fmt.reset}\n`);
  const { generateEvents } = await import("./generate-events.js");

  if (history) {
    await generateEvents();
  } else {
    const monthObjs = affectedMonths.map((ym: string) => {
      const [year, month] = ym.split("-");
      return { year, month };
    });
    await generateEvents({ months: monthObjs });
  }

  // Step 3: Generate markdown
  console.log(`\n${fmt.bold}━━━ Updating markdown files ━━━${fmt.reset}\n`);
  const { generateMarkdownFiles } = await import("./generate-md-files.js");
  generateMarkdownFiles();

  // Step 4: Stats
  printSyncStats();
}

function printSyncStats() {
  console.log(`\n${fmt.bold}━━━ Statistics ━━━${fmt.reset}\n`);

  const now = new Date();
  const allEvents = loadAllEvents();
  const futureEvents = allEvents.filter((e) => new Date(e.startAt) >= now);

  const byMonth = new Map<string, EventEntry[]>();
  const bySource = new Map<string, number>();

  for (const e of futureEvents) {
    const d = new Date(e.startAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);

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
      .map(([s, n]) => `${s}: ${n}`)
      .join(", ");
    console.log(`  ${fmt.cyan}${month}${fmt.reset}  ${events.length} events ${fmt.dim}(${srcStr})${fmt.reset}`);
  }

  console.log(`\n  ${fmt.bold}Total upcoming: ${futureEvents.length}${fmt.reset}`);

  const srcSummary = [...bySource.entries()]
    .map(([s, n]) => `${s}: ${n}`)
    .join(", ");
  if (srcSummary) {
    console.log(`  ${fmt.dim}By source: ${srcSummary}${fmt.reset}`);
  }

  console.log(`\n${fmt.green}✓ Done!${fmt.reset}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return;
  }

  // Only show global help if --help is the first arg (not after a command)
  if ((args[0] === "--help" || args[0] === "-h" || args[0] === "help") && args.length === 1) {
    printHelp();
    return;
  }

  if (getFlag(args, "--version", "-v")) {
    console.log(`chb v${VERSION}`);
    return;
  }

  const command = args[0];

  switch (command) {
    case "events": {
      const sub = args[1];
      if (sub === "sync") {
        await cmdEventsSync(args.slice(2));
      } else {
        // events list handles its own --help
        await cmdEventsList(args.slice(1));
      }
      break;
    }
    default:
      console.error(`${fmt.red}Unknown command: ${command}${fmt.reset}\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${fmt.red}Error:${fmt.reset}`, err.message || err);
  process.exit(1);
});
