import { Metadata } from "next";
import * as fs from "fs";
import * as path from "path";
import SyncDashboard from "./sync-dashboard";

export const metadata: Metadata = {
  title: "Sync Dashboard — Commons Hub",
  robots: "noindex",
};

export const dynamic = "force-dynamic";

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

function getAvailableYears(): number[] {
  const years: number[] = [];
  if (!fs.existsSync(DATA_DIR)) return years;
  try {
    for (const d of fs.readdirSync(DATA_DIR)) {
      if (/^\d{4}$/.test(d)) years.push(parseInt(d));
    }
  } catch {}
  return years.sort((a, b) => b - a);
}

function getMonthsData(yearFilter?: number): MonthData[] {
  const months: MonthData[] = [];
  if (!fs.existsSync(DATA_DIR)) return months;

  try {
    const years = fs
      .readdirSync(DATA_DIR)
      .filter((d) => /^\d{4}$/.test(d))
      .sort();

    for (const year of years) {
      if (yearFilter && parseInt(year) !== yearFilter) continue;

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

  return months.reverse();
}

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const yearFilter = params.year ? parseInt(params.year) : currentYear;
  const availableYears = getAvailableYears();
  // Ensure current year is always in the list
  if (!availableYears.includes(currentYear)) {
    availableYears.unshift(currentYear);
  }

  const syncState = getSyncState();
  const months = getMonthsData(yearFilter);
  const allMonths = getMonthsData();
  const totalEvents = allMonths.reduce((s, m) => s + m.events, 0);
  const totalBookings = allMonths.reduce((s, m) => s + m.bookings, 0);
  const totalTransactions = allMonths.reduce((s, m) => s + m.transactions, 0);
  const totalMessages = allMonths.reduce((s, m) => s + m.messages, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Sync Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Commons Hub data synchronization
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Last Sync
            </div>
            <div className="flex items-center gap-2">
              <SyncStatusBadge lastSync={syncState.lastSync} />
              <span className="text-sm text-gray-300">
                {syncState.lastSync
                  ? new Date(syncState.lastSync).toLocaleString("en-BE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Never"}
              </span>
              {syncState.duration && (
                <span className="text-xs text-gray-600">
                  ({syncState.duration})
                </span>
              )}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Data Directory
            </div>
            <code className="text-sm text-gray-300 font-mono">{DATA_DIR}</code>
            <div className="text-xs text-gray-600 mt-1">
              {allMonths.length} month{allMonths.length !== 1 ? "s" : ""} of
              data
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Events" value={totalEvents} />
          <StatCard label="Bookings" value={totalBookings} />
          <StatCard label="Transactions" value={totalTransactions} />
          <StatCard label="Messages" value={totalMessages} />
        </div>

        {/* Interactive sync controls + console + month table (client component) */}
        <SyncDashboard
          initialMonths={months}
          availableYears={availableYears}
          selectedYear={yearFilter}
        />
      </div>
    </div>
  );
}

function SyncStatusBadge({ lastSync }: { lastSync: string | null }) {
  if (!lastSync) {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-gray-600" />
    );
  }
  const hoursSince =
    (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
  if (hoursSince < 24) {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
    );
  }
  if (hoursSince < 72) {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
    );
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-xl font-bold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
