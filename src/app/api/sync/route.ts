/**
 * GET /api/sync — Returns sync status + per-month data overview
 * Uses CLI stats commands for data, falls back to direct filesystem scan
 * Accepts ?year=2025 to filter months by year
 */
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

interface StatsMonth {
  month: string;
  count: number;
  accounts?: string[];
  rooms?: string[];
  channels?: string[];
}

interface StatsResult {
  total: number;
  upcoming?: number;
  months: StatsMonth[];
}

interface MonthData {
  month: string;
  events: number;
  bookings: number;
  transactions: number;
  messages: number;
}

function runCliStats(resource: string): StatsResult | null {
  try {
    const chbPath = path.join(process.cwd(), "dist", "chb");
    const output = execSync(`${chbPath} ${resource} stats --format json`, {
      env: { ...process.env, DATA_DIR },
      timeout: 10000,
    });
    return JSON.parse(output.toString());
  } catch {
    return null;
  }
}

function getSyncState(): { lastSync: string | null; duration: string | null } {
  const stateFile = path.join(DATA_DIR, "sync-state.json");
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  } catch {
    return { lastSync: null, duration: null };
  }
}

function buildMonthsFromStats(
  events: StatsResult,
  transactions: StatsResult,
  bookings: StatsResult,
  messages: StatsResult,
  yearFilter?: string
): MonthData[] {
  // Collect all months from all stats
  const monthSet = new Set<string>();
  for (const stats of [events, transactions, bookings, messages]) {
    for (const m of stats.months) {
      monthSet.add(m.month);
    }
  }

  // Build lookup maps
  const eventsMap = new Map(events.months.map((m) => [m.month, m.count]));
  const txMap = new Map(transactions.months.map((m) => [m.month, m.count]));
  const bookingsMap = new Map(bookings.months.map((m) => [m.month, m.count]));
  const messagesMap = new Map(messages.months.map((m) => [m.month, m.count]));

  let months = Array.from(monthSet)
    .sort()
    .reverse()
    .map((month) => ({
      month,
      events: eventsMap.get(month) || 0,
      bookings: bookingsMap.get(month) || 0,
      transactions: txMap.get(month) || 0,
      messages: messagesMap.get(month) || 0,
    }));

  if (yearFilter) {
    months = months.filter((m) => m.month.startsWith(yearFilter));
  }

  return months;
}

// Fallback: direct filesystem scan (used when CLI is not available)
function getMonthsDataFallback(yearFilter?: string): MonthData[] {
  const months: MonthData[] = [];
  if (!fs.existsSync(DATA_DIR)) return months;

  try {
    const years = fs
      .readdirSync(DATA_DIR)
      .filter((d) => /^\d{4}$/.test(d))
      .sort();

    for (const year of years) {
      if (yearFilter && year !== yearFilter) continue;
      const yearDir = path.join(DATA_DIR, year);
      if (!fs.statSync(yearDir).isDirectory()) continue;

      const monthDirs = fs
        .readdirSync(yearDir)
        .filter((d) => /^\d{2}$/.test(d))
        .sort();

      for (const month of monthDirs) {
        const monthDir = path.join(yearDir, month);
        if (!fs.statSync(monthDir).isDirectory()) continue;

        months.push({
          month: `${year}-${month}`,
          events: countEventsInMonth(monthDir),
          bookings: countBookingsInMonth(monthDir),
          transactions: countTransactionsInMonth(monthDir),
          messages: countMessagesInMonth(monthDir),
        });
      }
    }
  } catch {}

  return months.reverse();
}

function countJsonArrayField(filePath: string, field: string): number {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(data[field]) ? data[field].length : 0;
  } catch {
    return 0;
  }
}

function countEventsInMonth(monthDir: string): number {
  return countJsonArrayField(path.join(monthDir, "events.json"), "events");
}

function countTransactionsInMonth(monthDir: string): number {
  const financeDir = path.join(monthDir, "finance");
  if (!fs.existsSync(financeDir)) return 0;
  let total = 0;
  try {
    for (const chain of fs.readdirSync(financeDir)) {
      const chainDir = path.join(financeDir, chain);
      if (!fs.statSync(chainDir).isDirectory()) continue;
      for (const file of fs.readdirSync(chainDir)) {
        if (file.endsWith(".json")) {
          total += countJsonArrayField(
            path.join(chainDir, file),
            "transactions"
          );
        }
      }
    }
  } catch {}
  return total;
}

function countMessagesInMonth(monthDir: string): number {
  const channelsDir = path.join(monthDir, "channels", "discord");
  if (!fs.existsSync(channelsDir)) return 0;
  let total = 0;
  try {
    for (const channelId of fs.readdirSync(channelsDir)) {
      const msgFile = path.join(channelsDir, channelId, "messages.json");
      total += countJsonArrayField(msgFile, "messages");
    }
  } catch {}
  return total;
}

function countBookingsInMonth(monthDir: string): number {
  const icsDir = path.join(monthDir, "calendars", "ics");
  try {
    return fs
      .readdirSync(icsDir)
      .filter((f) => f.endsWith(".ics")).length;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  const yearFilter = request.nextUrl.searchParams.get("year") || undefined;
  const syncState = getSyncState();

  // Try CLI stats first
  const eventsStats = runCliStats("events");
  const transactionsStats = runCliStats("transactions");
  const bookingsStats = runCliStats("bookings");
  const messagesStats = runCliStats("messages");

  const useCli =
    eventsStats && transactionsStats && bookingsStats && messagesStats;

  const months = useCli
    ? buildMonthsFromStats(
        eventsStats,
        transactionsStats,
        bookingsStats,
        messagesStats,
        yearFilter
      )
    : getMonthsDataFallback(yearFilter);

  return NextResponse.json({
    lastSync: syncState.lastSync,
    duration: syncState.duration,
    dataDir: DATA_DIR,
    months,
    ...(useCli
      ? {
          totals: {
            events: eventsStats.total,
            upcoming: eventsStats.upcoming,
            transactions: transactionsStats.total,
            bookings: bookingsStats.total,
            messages: messagesStats.total,
          },
        }
      : {}),
  });
}
