/**
 * GET /api/sync — Returns sync status + per-month data overview
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

interface MonthData {
  month: string;
  events: number;
  bookings: number;
  transactions: number;
  messages: number;
}

function countJsonArrayItems(filePath: string): number {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

function countFilesInDir(dirPath: string, ext?: string): number {
  try {
    const files = fs.readdirSync(dirPath);
    return ext ? files.filter((f) => f.endsWith(ext)).length : files.length;
  } catch {
    return 0;
  }
}

function countTransactions(monthDir: string): number {
  const financeDir = path.join(monthDir, "finance");
  if (!fs.existsSync(financeDir)) return 0;
  let total = 0;
  try {
    for (const chain of fs.readdirSync(financeDir)) {
      const chainDir = path.join(financeDir, chain);
      if (!fs.statSync(chainDir).isDirectory()) continue;
      for (const file of fs.readdirSync(chainDir)) {
        if (file.endsWith(".json")) {
          total += countJsonArrayItems(path.join(chainDir, file));
        }
      }
    }
  } catch {}
  return total;
}

function countMessages(monthDir: string): number {
  const channelsDir = path.join(monthDir, "channels", "discord");
  if (!fs.existsSync(channelsDir)) return 0;
  let total = 0;
  try {
    for (const channelId of fs.readdirSync(channelsDir)) {
      const msgFile = path.join(channelsDir, channelId, "messages.json");
      total += countJsonArrayItems(msgFile);
    }
  } catch {}
  return total;
}

function countBookings(monthDir: string): number {
  const icsDir = path.join(monthDir, "calendars", "ics");
  return countFilesInDir(icsDir, ".ics");
}

function getSyncState(): { lastSync: string | null; duration: string | null } {
  const stateFile = path.join(DATA_DIR, "sync-state.json");
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  } catch {
    return { lastSync: null, duration: null };
  }
}

function getMonthsData(): MonthData[] {
  const months: MonthData[] = [];
  if (!fs.existsSync(DATA_DIR)) return months;

  try {
    const years = fs
      .readdirSync(DATA_DIR)
      .filter((d) => /^\d{4}$/.test(d))
      .sort();

    for (const year of years) {
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
          events: countJsonArrayItems(path.join(monthDir, "events.json")),
          bookings: countBookings(monthDir),
          transactions: countTransactions(monthDir),
          messages: countMessages(monthDir),
        });
      }
    }
  } catch {}

  return months.reverse(); // newest first
}

export async function GET() {
  const syncState = getSyncState();
  const months = getMonthsData();

  return NextResponse.json({
    lastSync: syncState.lastSync,
    duration: syncState.duration,
    dataDir: DATA_DIR,
    months,
  });
}
