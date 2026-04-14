import { Metadata } from "next";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "@/lib/data-paths";
import SyncDashboard from "./sync-dashboard";

export const metadata: Metadata = {
  title: "Sync Dashboard — Commons Hub",
  robots: "noindex",
};

export const dynamic = "force-dynamic";

interface StatsResult {
  total: number;
  upcoming?: number;
  months: Array<{ month: string; count: number }>;
}

function chbBinary(): string {
  for (const p of ["/usr/local/bin/chb"]) {
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  throw new Error("chb binary not found. Install it from github.com/commonshub/chb.");
}

function runStats(bin: string, resource: string): StatsResult {
  const output = execSync(`${bin} ${resource} stats --format json`, {
    env: { ...process.env, DATA_DIR },
    timeout: 10000,
    encoding: "utf-8",
  });
  return JSON.parse(output);
}

function getSyncState(): { lastSync: string | null; duration: string | null } {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "sync-state.json"), "utf-8"));
  } catch {
    return { lastSync: null, duration: null };
  }
}

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const yearFilter = params.year ? parseInt(params.year) : currentYear;
  const syncState = getSyncState();

  let totals = { events: 0, upcoming: 0, bookings: 0, transactions: 0, messages: 0 };
  let months: Array<{ month: string; events: number; bookings: number; transactions: number; messages: number }> = [];
  let availableYears: number[] = [currentYear];
  let error: string | null = null;

  try {
    const bin = chbBinary();
    const events = runStats(bin, "events");
    const transactions = runStats(bin, "transactions");
    const bookings = runStats(bin, "bookings");
    const messages = runStats(bin, "messages");

    totals = {
      events: events.total,
      upcoming: events.upcoming || 0,
      transactions: transactions.total,
      bookings: bookings.total,
      messages: messages.total,
    };

    // Collect all months and years
    const monthSet = new Set<string>();
    const yearSet = new Set<number>();
    for (const stats of [events, transactions, bookings, messages]) {
      for (const m of stats.months) {
        monthSet.add(m.month);
        yearSet.add(parseInt(m.month.split("-")[0]));
      }
    }
    if (!yearSet.has(currentYear)) yearSet.add(currentYear);
    availableYears = Array.from(yearSet).sort((a, b) => b - a);

    const evMap = new Map(events.months.map((m) => [m.month, m.count]));
    const txMap = new Map(transactions.months.map((m) => [m.month, m.count]));
    const bkMap = new Map(bookings.months.map((m) => [m.month, m.count]));
    const msMap = new Map(messages.months.map((m) => [m.month, m.count]));

    months = Array.from(monthSet)
      .filter((m) => m.startsWith(yearFilter.toString()))
      .sort()
      .reverse()
      .map((month) => ({
        month,
        events: evMap.get(month) || 0,
        bookings: bkMap.get(month) || 0,
        transactions: txMap.get(month) || 0,
        messages: msMap.get(month) || 0,
      }));
  } catch (err: any) {
    error = err.message;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Sync Dashboard
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Commons Hub data synchronization
          </p>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-8 text-sm text-red-300">
            <strong>CLI error:</strong> {error}
            <p className="text-red-500 mt-1 text-xs">
              Install the CLI from <code>github.com/commonshub/chb</code> and make sure <code>chb</code> is available at <code>/usr/local/bin/chb</code>.
            </p>
          </div>
        )}

        {/* Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Last Sync</div>
            <div className="flex items-center gap-2">
              <SyncStatusBadge lastSync={syncState.lastSync} />
              <span className="text-sm text-gray-300">
                {syncState.lastSync
                  ? new Date(syncState.lastSync).toLocaleString("en-BE", { dateStyle: "medium", timeStyle: "short" })
                  : "Never"}
              </span>
              {syncState.duration && (
                <span className="text-xs text-gray-600">({syncState.duration})</span>
              )}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Data Directory</div>
            <code className="text-sm text-gray-300 font-mono">{DATA_DIR}</code>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Events" value={totals.events} subtitle={`${totals.upcoming} upcoming`} />
          <StatCard label="Bookings" value={totals.bookings} />
          <StatCard label="Transactions" value={totals.transactions} />
          <StatCard label="Messages" value={totals.messages} />
        </div>

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
  if (!lastSync) return <span className="inline-block w-2 h-2 rounded-full bg-gray-600" />;
  const hours = (Date.now() - new Date(lastSync).getTime()) / 3600000;
  const color = hours < 24 ? "bg-green-500" : hours < 72 ? "bg-yellow-500" : "bg-red-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function StatCard({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value.toLocaleString()}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
    </div>
  );
}
