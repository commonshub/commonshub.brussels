#!/usr/bin/env -S npx tsx
/**
 * chb — CLI tool for Commons Hub Brussels data management
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import ical from "node-ical";
import settings from "../src/settings/settings.json";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const TIMEZONE = "Europe/Brussels";
const VERSION = "1.1.0";

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
  ? (Object.fromEntries(Object.keys(c).map((k) => [k, ""])) as typeof c)
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

function getNumber(
  args: string[],
  flags: string[],
  defaultVal: number
): number {
  const val = getOption(args, ...flags);
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  return isNaN(n) ? defaultVal : n;
}

function parseSinceDate(str: string | null): Date | null {
  if (!str) return null;
  const clean = str.replace(/-/g, "");
  if (clean.length !== 8) return null;
  return new Date(`${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}T00:00:00`);
}

function computeMonthRange(sinceStr: string | null): {
  startMonth: string;
  endMonth: string;
} {
  const now = new Date();
  let startMonth: string;
  if (sinceStr) {
    const d = parseSinceDate(sinceStr);
    startMonth = d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  } else {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  }
  const future = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const endMonth = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}`;
  return { startMonth, endMonth };
}

// ── Data loading ───────────────────────────────────────────────────────────

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

interface BookingEntry {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  room: string;
}

interface RoomInfo {
  slug: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  tokensPerHour: number;
  googleCalendarId: string | null;
  features?: string[];
}

function loadRooms(): RoomInfo[] {
  const roomsPath = path.join(process.cwd(), "src", "settings", "rooms.json");
  if (!fs.existsSync(roomsPath)) return [];
  const data = JSON.parse(fs.readFileSync(roomsPath, "utf-8"));
  return data.rooms || [];
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
        /* skip */
      }
    }
  }

  events.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  return events;
}

async function loadAllBookings(): Promise<BookingEntry[]> {
  const bookings: BookingEntry[] = [];
  if (!fs.existsSync(DATA_DIR)) return bookings;

  const rooms = loadRooms();
  const roomSlugs = new Set(rooms.map((r) => r.slug));

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
      const icsDir = path.join(yearPath, month, "calendars", "ics");
      if (!fs.existsSync(icsDir)) continue;

      const icsFiles = fs
        .readdirSync(icsDir)
        .filter((f) => f.endsWith(".ics"));

      for (const file of icsFiles) {
        const slug = file.replace(".ics", "");
        if (!roomSlugs.has(slug)) continue; // only room calendars

        const room = rooms.find((r) => r.slug === slug);
        if (!room) continue;

        try {
          const content = fs.readFileSync(path.join(icsDir, file), "utf-8");
          const events = await ical.async.parseICS(content);

          for (const [, event] of Object.entries(events)) {
            if ((event as any).type !== "VEVENT") continue;
            const ev = event as any;
            if (!ev.start) continue;

            bookings.push({
              uid: ev.uid || "",
              title: ev.summary || "Untitled",
              start: new Date(ev.start),
              end: ev.end ? new Date(ev.end) : new Date(ev.start),
              room: room.name,
            });
          }
        } catch {
          /* skip corrupt files */
        }
      }
    }
  }

  bookings.sort((a, b) => a.start.getTime() - b.start.getTime());
  return bookings;
}

// ── Formatting ─────────────────────────────────────────────────────────────

function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: TIMEZONE,
  });
}

function fmtTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-GB", {
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
  ${fmt.cyan}events sync${fmt.reset}         Fetch events from Luma feeds
  ${fmt.cyan}rooms${fmt.reset}               List all rooms with pricing
  ${fmt.cyan}bookings${fmt.reset}            List upcoming room bookings
  ${fmt.cyan}bookings sync${fmt.reset}       Sync room booking calendars

${fmt.bold}OPTIONS${fmt.reset}
  ${fmt.yellow}--help, -h${fmt.reset}          Show help for a command
  ${fmt.yellow}--version, -v${fmt.reset}       Show version

${fmt.bold}EXAMPLES${fmt.reset}
  ${fmt.dim}$ chb events                          # next 10 upcoming events
  $ chb events sync                      # sync events from Luma
  $ chb rooms                            # list rooms + pricing
  $ chb bookings                         # next 10 bookings
  $ chb bookings sync                    # sync all room calendars
  $ chb bookings sync --room satoshi     # sync one room only${fmt.reset}

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
`);
}

function printEventsSyncHelp() {
  console.log(`
${fmt.bold}chb events sync${fmt.reset} — Fetch events from Luma and regenerate data

${fmt.bold}USAGE${fmt.reset}
  ${fmt.cyan}chb events sync${fmt.reset} [options]

${fmt.bold}OPTIONS${fmt.reset}
  ${fmt.yellow}--since${fmt.reset} <YYYYMMDD>   Start syncing from this date (default: last month)
  ${fmt.yellow}--force${fmt.reset}              Re-fetch even if cached data exists
  ${fmt.yellow}--history${fmt.reset}            Rebuild entire event history
  ${fmt.yellow}--help, -h${fmt.reset}           Show this help

${fmt.bold}SOURCES${fmt.reset}
  • Luma ICS feed (calendar events)
  • Luma API (covers, guests, tags — requires LUMA_API_KEY)
`);
}

function printBookingsHelp() {
  console.log(`
${fmt.bold}chb bookings${fmt.reset} — List room bookings from cached calendar data

${fmt.bold}USAGE${fmt.reset}
  ${fmt.cyan}chb bookings${fmt.reset} [options]

${fmt.bold}OPTIONS${fmt.reset}
  ${fmt.yellow}-n${fmt.reset} <count>           Number of bookings to show (default: 10)
  ${fmt.yellow}--skip${fmt.reset} <count>       Skip first N bookings
  ${fmt.yellow}--date${fmt.reset} <YYYYMMDD>    Show bookings for a specific date
  ${fmt.yellow}--room${fmt.reset} <slug>        Filter by room slug
  ${fmt.yellow}--all${fmt.reset}                Show all bookings (no date filter)
  ${fmt.yellow}--help, -h${fmt.reset}           Show this help
`);
}

function printBookingsSyncHelp() {
  console.log(`
${fmt.bold}chb bookings sync${fmt.reset} — Sync room booking calendars from Google Calendar

${fmt.bold}USAGE${fmt.reset}
  ${fmt.cyan}chb bookings sync${fmt.reset} [options]

${fmt.bold}OPTIONS${fmt.reset}
  ${fmt.yellow}--room${fmt.reset} <slug>        Only sync a specific room (e.g. satoshi)
  ${fmt.yellow}--force${fmt.reset}              Re-fetch even if cached data exists
  ${fmt.yellow}--since${fmt.reset} <YYYYMMDD>   Start syncing from this date
  ${fmt.yellow}--help, -h${fmt.reset}           Show this help
`);
}

// ── Commands: events ───────────────────────────────────────────────────────

async function cmdEventsList(args: string[]): Promise<void> {
  if (getFlag(args, "--help", "-h")) return printEventsHelp();

  const n = getNumber(args, ["-n"], 10);
  const skip = getNumber(args, ["--skip"], 0);
  const showAll = getFlag(args, "--all");
  const sinceDate =
    parseSinceDate(getOption(args, "--since")) ||
    (showAll ? new Date(0) : new Date());

  const allEvents = loadAllEvents();
  const filtered = allEvents.filter((e) => new Date(e.startAt) >= sinceDate);
  const sliced = filtered.slice(skip, skip + n);

  if (sliced.length === 0) {
    console.log(`\n${fmt.dim}No events found.${fmt.reset}`);
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`${fmt.yellow}DATA_DIR not found:${fmt.reset} ${DATA_DIR}`);
      console.log(`${fmt.dim}Run 'chb events sync' to fetch events.${fmt.reset}`);
    }
    console.log("");
    return;
  }

  const rows = sliced.map((e) => ({
    date: fmtDate(e.startAt),
    time: fmtTime(e.startAt),
    title: e.name,
    tags: e.tags?.map((t) => t.name).join(", ") || "",
    url: e.url || "",
  }));

  const maxTitle = Math.min(
    45,
    Math.max(5, ...rows.map((r) => r.title.length))
  );
  const maxTags = Math.min(
    25,
    Math.max(4, ...rows.map((r) => r.tags.length))
  );

  console.log(
    `\n${fmt.bold}📅 Events${fmt.reset} ${fmt.dim}(${sliced.length} of ${filtered.length}${skip > 0 ? `, skip ${skip}` : ""})${fmt.reset}\n`
  );
  console.log(
    `${fmt.dim}${pad("DATE", 16)} ${pad("TIME", 6)} ${pad("TITLE", maxTitle)} ${pad("TAGS", maxTags)} URL${fmt.reset}`
  );

  for (const row of rows) {
    const tagsStr = row.tags
      ? `${fmt.dim}${truncate(row.tags, maxTags)}${fmt.reset}`
      : "";
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
  if (getFlag(args, "--help", "-h")) return printEventsSyncHelp();

  const force = getFlag(args, "--force");
  const history = getFlag(args, "--history");
  const sinceStr = getOption(args, "--since");

  const monthRange = history ? null : computeMonthRange(sinceStr);

  // Show env info
  const lumaIcsUrl = (settings as any).calendars?.luma;
  console.log(`\n${fmt.dim}DATA_DIR: ${DATA_DIR}${fmt.reset}`);
  console.log(`${fmt.dim}LUMA_API_KEY: ${process.env.LUMA_API_KEY ? "set" : "missing (falling back to OG scraping)"}${fmt.reset}`);

  // Step 1: Fetch event calendars (Luma only, no rooms)
  const rangeLabel = monthRange
    ? `${monthRange.startMonth} → ${monthRange.endMonth}`
    : "all history";
  console.log(`\n📅 Fetching Luma calendar ${fmt.dim}(${rangeLabel})${fmt.reset}`);
  console.log(`  ${fmt.dim}${lumaIcsUrl}${fmt.reset}`);
  const { fetchEventCalendars } = await import("./fetch-calendars.js");
  const fetchResult = await fetchEventCalendars({
    forceFetch: force,
    startMonth: monthRange?.startMonth ?? null,
    endMonth: monthRange?.endMonth ?? null,
    quiet: true,
  });

  // Step 2: Generate events.json
  const { generateEvents } = await import("./generate-events.js");

  let monthResults;
  if (history) {
    monthResults = await generateEvents({ quiet: true });
  } else {
    const monthObjs = fetchResult.affectedMonths.map((ym: string) => {
      const [year, month] = ym.split("-");
      return { year, month };
    });
    monthResults = await generateEvents({ months: monthObjs, quiet: true });
  }

  // Step 3: Generate markdown (quiet)
  const { generateMarkdownFiles } = await import("./generate-md-files.js");
  generateMarkdownFiles({ quiet: true });
  const eventsMdPath = path.resolve(process.cwd(), "public", "events.md");

  // Step 4: Print concise output
  const monthsWithNewEvents = monthResults.filter((r: any) => r.newEvents.length > 0);

  if (monthsWithNewEvents.length > 0) {
    console.log(`\n📊 Processing months...`);
    for (const result of monthsWithNewEvents) {
      const count = result.newEvents.length;
      console.log(`  ${result.yearMonth} ${fmt.green}✓${fmt.reset} ${count} new event${count !== 1 ? "s" : ""}`);
      for (const evt of result.newEvents) {
        const d = new Date(evt.startAt);
        const dateStr = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
        console.log(`    + ${fmt.dim}${dateStr}${fmt.reset} ${evt.name} ${fmt.dim}(via ${evt.metadataSource})${fmt.reset}`);
      }
    }
  }

  // Final summary with breakdown
  const now = new Date();
  const allEvents = loadAllEvents();
  const futureEvents = allEvents.filter((e) => new Date(e.startAt) >= now);

  // Breakdown: own (luma-api) vs community
  const ownEvents = futureEvents.filter((e) => e.calendarSource === "luma-api");
  const communityEvents = futureEvents.filter((e) => e.calendarSource !== "luma-api");

  // Domain breakdown from event URLs
  const domainCounts = new Map<string, number>();
  for (const e of futureEvents) {
    let domain = "no url";
    if (e.url) {
      try {
        domain = new URL(e.url).hostname.replace(/^www\./, "");
      } catch {
        domain = "invalid url";
      }
    }
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  // Count events written to events.md
  let eventsMdCount = 0;
  try {
    const mdContent = fs.readFileSync(eventsMdPath, "utf-8");
    eventsMdCount = (mdContent.match(/^### /gm) || []).length;
  } catch {}

  console.log(`\n${fmt.green}✓ Done!${fmt.reset} ${allEvents.length} total events, ${futureEvents.length} upcoming`);
  console.log(`  ${fmt.dim}own: ${ownEvents.length} (via Luma API) · community: ${communityEvents.length}${fmt.reset}`);

  // Domain breakdown (sorted by count desc)
  const sortedDomains = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]);
  const domainStr = sortedDomains.map(([d, n]) => `${d}: ${n}`).join(", ");
  console.log(`  ${fmt.dim}${domainStr}${fmt.reset}`);

  console.log(`  ${eventsMdCount} events written to ${eventsMdPath}\n`);
}

// ── Commands: rooms ────────────────────────────────────────────────────────

function cmdRooms(args: string[]): void {
  if (getFlag(args, "--help", "-h")) {
    console.log(`
${fmt.bold}chb rooms${fmt.reset} — List all rooms with pricing

${fmt.bold}USAGE${fmt.reset}
  ${fmt.cyan}chb rooms${fmt.reset}
`);
    return;
  }

  const rooms = loadRooms();
  if (rooms.length === 0) {
    console.log(
      `\n${fmt.dim}No rooms found. Is src/settings/rooms.json present?${fmt.reset}\n`
    );
    return;
  }

  console.log(`\n${fmt.bold}🏠 Rooms${fmt.reset}\n`);

  const maxName = Math.max(4, ...rooms.map((r) => r.name.length));
  const maxSlug = Math.max(4, ...rooms.map((r) => r.slug.length));

  console.log(
    `${fmt.dim}${pad("NAME", maxName)}  ${pad("SLUG", maxSlug)}  ${pad("CAP", 4)}  ${pad("EUR/h", 6)}  ${pad("CHT/h", 6)}  CALENDAR${fmt.reset}`
  );

  for (const room of rooms) {
    const eur =
      room.pricePerHour > 0 ? `€${room.pricePerHour}` : `${fmt.dim}free${fmt.reset}`;
    const cht =
      room.tokensPerHour > 0
        ? `${room.tokensPerHour}`
        : `${fmt.dim}—${fmt.reset}`;
    const cal = room.googleCalendarId ? `${fmt.green}✓${fmt.reset}` : `${fmt.dim}—${fmt.reset}`;

    console.log(
      `${fmt.bold}${pad(room.name, maxName)}${fmt.reset}  ${pad(room.slug, maxSlug)}  ${pad(String(room.capacity), 4)}  ${pad(eur, 6)}  ${pad(cht, 6)}  ${cal}`
    );
  }
  console.log("");
}

// ── Commands: bookings ─────────────────────────────────────────────────────

async function cmdBookingsList(args: string[]): Promise<void> {
  if (getFlag(args, "--help", "-h")) return printBookingsHelp();

  const n = getNumber(args, ["-n"], 10);
  const skip = getNumber(args, ["--skip"], 0);
  const showAll = getFlag(args, "--all");
  const dateStr = getOption(args, "--date");
  const roomFilter = getOption(args, "--room");

  let filterDate: Date | null = null;
  let filterDateEnd: Date | null = null;

  if (dateStr) {
    filterDate = parseSinceDate(dateStr);
    if (filterDate) {
      filterDateEnd = new Date(filterDate);
      filterDateEnd.setDate(filterDateEnd.getDate() + 1);
    }
  }

  const sinceDate = filterDate || (showAll ? new Date(0) : new Date());

  const allBookings = await loadAllBookings();
  let filtered = allBookings.filter((b) => {
    if (filterDate && filterDateEnd) {
      return b.start >= filterDate && b.start < filterDateEnd;
    }
    return b.start >= sinceDate;
  });

  if (roomFilter) {
    const rooms = loadRooms();
    const room = rooms.find((r) => r.slug === roomFilter);
    if (room) {
      filtered = filtered.filter((b) => b.room === room.name);
    } else {
      console.log(
        `\n${fmt.red}Unknown room: ${roomFilter}${fmt.reset}. Run 'chb rooms' to see available rooms.\n`
      );
      return;
    }
  }

  const sliced = filtered.slice(skip, skip + n);

  if (sliced.length === 0) {
    console.log(`\n${fmt.dim}No bookings found.${fmt.reset}`);
    if (!fs.existsSync(DATA_DIR)) {
      console.log(
        `${fmt.dim}Run 'chb bookings sync' to fetch room calendars.${fmt.reset}`
      );
    }
    console.log("");
    return;
  }

  const maxRoom = Math.min(
    20,
    Math.max(4, ...sliced.map((b) => b.room.length))
  );
  const maxTitle = Math.min(
    40,
    Math.max(5, ...sliced.map((b) => b.title.length))
  );

  const label = dateStr
    ? `Bookings on ${fmtDate(sinceDate)}`
    : "Upcoming bookings";

  console.log(
    `\n${fmt.bold}📋 ${label}${fmt.reset} ${fmt.dim}(${sliced.length} of ${filtered.length}${skip > 0 ? `, skip ${skip}` : ""})${fmt.reset}\n`
  );
  console.log(
    `${fmt.dim}${pad("DATE", 16)} ${pad("TIME", 14)} ${pad("ROOM", maxRoom)} TITLE${fmt.reset}`
  );

  for (const b of sliced) {
    const timeRange = `${fmtTime(b.start)}–${fmtTime(b.end)}`;
    console.log(
      `${fmt.green}${pad(fmtDate(b.start), 16)}${fmt.reset} ${fmt.cyan}${pad(timeRange, 14)}${fmt.reset} ${pad(truncate(b.room, maxRoom), maxRoom)} ${truncate(b.title, maxTitle)}`
    );
  }

  if (filtered.length > skip + n) {
    console.log(
      `\n${fmt.dim}… ${filtered.length - skip - n} more. Use -n or --skip to paginate.${fmt.reset}`
    );
  }
  console.log("");
}

async function cmdBookingsSync(args: string[]): Promise<void> {
  if (getFlag(args, "--help", "-h")) return printBookingsSyncHelp();

  const force = getFlag(args, "--force");
  const roomSlug = getOption(args, "--room");
  const sinceStr = getOption(args, "--since");

  const { startMonth, endMonth } = computeMonthRange(sinceStr);

  const target = roomSlug ? `room "${roomSlug}"` : "all rooms";
  console.log(
    `\n${fmt.bold}📋 Syncing bookings${fmt.reset} ${fmt.dim}(${target}, ${startMonth} → ${endMonth})${fmt.reset}\n`
  );

  const { fetchBookingCalendars } = await import("./fetch-calendars.js");
  await fetchBookingCalendars({
    forceFetch: force,
    startMonth,
    endMonth,
    roomSlug: roomSlug || undefined,
  });

  // Show stats
  const bookings = await loadAllBookings();
  const now = new Date();
  const upcoming = bookings.filter((b) => b.start >= now);

  const byRoom = new Map<string, number>();
  for (const b of upcoming) {
    byRoom.set(b.room, (byRoom.get(b.room) || 0) + 1);
  }

  console.log(`\n${fmt.bold}━━━ Booking Statistics ━━━${fmt.reset}\n`);
  for (const [room, count] of [...byRoom.entries()].sort()) {
    console.log(`  ${pad(room, 20)} ${count} upcoming`);
  }
  console.log(`\n  ${fmt.bold}Total: ${upcoming.length} upcoming bookings${fmt.reset}`);
  console.log(`\n${fmt.green}✓ Done!${fmt.reset}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return;
  }

  if (
    (args[0] === "--help" || args[0] === "-h" || args[0] === "help") &&
    args.length === 1
  ) {
    printHelp();
    return;
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log(`chb v${VERSION}`);
    return;
  }

  const command = args[0];

  switch (command) {
    case "events": {
      if (args[1] === "sync") {
        await cmdEventsSync(args.slice(2));
      } else {
        await cmdEventsList(args.slice(1));
      }
      break;
    }
    case "rooms": {
      cmdRooms(args.slice(1));
      break;
    }
    case "bookings": {
      if (args[1] === "sync") {
        await cmdBookingsSync(args.slice(2));
      } else {
        await cmdBookingsList(args.slice(1));
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
