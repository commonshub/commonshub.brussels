"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface MonthData {
  month: string;
  events: number;
  bookings: number;
  transactions: number;
  messages: number;
}

type SyncCommand = "events" | "transactions" | "messages" | "bookings" | "all";

interface LogLine {
  stream: string;
  text: string;
  timestamp: number;
}

const SYNC_BUTTONS: { command: SyncCommand; label: string; icon: string }[] = [
  { command: "events", label: "Events", icon: "📅" },
  { command: "transactions", label: "Transactions", icon: "💰" },
  { command: "messages", label: "Messages", icon: "💬" },
  { command: "bookings", label: "Bookings", icon: "🏠" },
  { command: "all", label: "Sync All", icon: "🔄" },
];

export default function SyncDashboard({
  initialMonths,
  availableYears,
  selectedYear,
}: {
  initialMonths: MonthData[];
  availableYears: number[];
  selectedYear: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState<SyncCommand | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<{
    success: boolean;
    duration: string;
  } | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const consoleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const allSelected =
    initialMonths.length > 0 &&
    initialMonths.every((m) => selectedMonths.has(m.month));

  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedMonths(new Set());
    } else {
      setSelectedMonths(new Set(initialMonths.map((m) => m.month)));
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedMonths(new Set());
    router.push(`/sync?year=${year}`);
  };

  const runSync = async (command: SyncCommand, months?: string[]) => {
    if (running) return;

    setRunning(command);
    setLogs([]);
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = new URLSearchParams();
      if (months && months.length > 0) {
        params.set("months", months.join(","));
      }

      const url = `/api/sync/${command}${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.stream === "done") {
              setResult({
                success: data.success,
                duration: data.duration,
              });
            } else {
              setLogs((prev) => [
                ...prev,
                {
                  stream: data.stream,
                  text: data.text,
                  timestamp: Date.now(),
                },
              ]);
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setLogs((prev) => [
          ...prev,
          {
            stream: "error",
            text: `Connection error: ${err.message}`,
            timestamp: Date.now(),
          },
        ]);
        setResult({ success: false, duration: "0s" });
      }
    } finally {
      setRunning(null);
      abortRef.current = null;
    }
  };

  const resyncSelected = () => {
    if (selectedMonths.size === 0) return;
    const months = Array.from(selectedMonths).sort();
    runSync("all", months);
  };

  return (
    <div>
      {/* Year selector + Sync buttons row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 uppercase tracking-wider">
            Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-gray-600"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-gray-800" />

        {SYNC_BUTTONS.map(({ command, label, icon }) => (
          <button
            key={command}
            onClick={() => runSync(command)}
            disabled={running !== null}
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-150
              ${
                running === command
                  ? "bg-blue-600 text-white"
                  : running !== null
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : command === "all"
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              }
            `}
          >
            {running === command ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>{icon}</span>
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            result.success
              ? "bg-green-900/30 border border-green-800 text-green-400"
              : "bg-red-900/30 border border-red-800 text-red-400"
          }`}
        >
          {result.success ? "✓" : "✗"} Sync{" "}
          {result.success ? "completed" : "failed"} in {result.duration}
          {result.success && (
            <button
              onClick={() => window.location.reload()}
              className="ml-3 underline hover:no-underline text-green-500"
            >
              Refresh data
            </button>
          )}
        </div>
      )}

      {/* Console output */}
      {(logs.length > 0 || running) && (
        <div className="rounded-lg border border-gray-800 overflow-hidden mb-6">
          <div className="bg-gray-900 px-3 py-1.5 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-mono">console</span>
            {logs.length > 0 && !running && (
              <button
                onClick={() => {
                  setLogs([]);
                  setResult(null);
                }}
                className="text-xs text-gray-600 hover:text-gray-400"
              >
                Clear
              </button>
            )}
          </div>
          <div
            ref={consoleRef}
            className="bg-black p-3 font-mono text-xs leading-relaxed max-h-96 overflow-y-auto"
          >
            {logs.length === 0 && running && (
              <div className="text-gray-600 animate-pulse">
                Starting sync...
              </div>
            )}
            {logs.map((log, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all ${
                  log.stream === "stderr"
                    ? "text-yellow-500"
                    : log.stream === "system"
                      ? "text-blue-400 font-semibold"
                      : log.stream === "error"
                        ? "text-red-400"
                        : "text-gray-400"
                }`}
              >
                {log.text}
              </div>
            ))}
            {running && (
              <span className="inline-block w-2 h-4 bg-gray-500 animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Per-month data table with checkboxes */}
      {initialMonths.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">
              Data by Month — {selectedYear}
            </h2>
            {selectedMonths.size > 0 && (
              <button
                onClick={resyncSelected}
                disabled={running !== null}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  running !== null
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : "bg-orange-600 hover:bg-orange-500 text-white"
                }`}
              >
                🔄 Resync Selected ({selectedMonths.size})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left py-2 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                    />
                  </th>
                  <th className="text-left py-2 pr-4">Month</th>
                  <th className="text-right py-2 px-3">Events</th>
                  <th className="text-right py-2 px-3">Bookings</th>
                  <th className="text-right py-2 px-3">Transactions</th>
                  <th className="text-right py-2 px-3">Messages</th>
                </tr>
              </thead>
              <tbody>
                {initialMonths.map((m) => (
                  <tr
                    key={m.month}
                    className={`border-b border-gray-800/50 hover:bg-gray-900/50 ${
                      selectedMonths.has(m.month) ? "bg-gray-900/30" : ""
                    }`}
                  >
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedMonths.has(m.month)}
                        onChange={() => toggleMonth(m.month)}
                        className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                      />
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-300">
                      {m.month}
                    </td>
                    <td className="text-right py-2 px-3">
                      <NumCell value={m.events} />
                    </td>
                    <td className="text-right py-2 px-3">
                      <NumCell value={m.bookings} />
                    </td>
                    <td className="text-right py-2 px-3">
                      <NumCell value={m.transactions} />
                    </td>
                    <td className="text-right py-2 px-3">
                      <NumCell value={m.messages} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NumCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-700">—</span>;
  return <span className="text-gray-300">{value.toLocaleString()}</span>;
}
