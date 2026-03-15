"use client";

import { useState, useRef, useCallback, useEffect } from "react";

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
}: {
  initialMonths: MonthData[];
}) {
  const [running, setRunning] = useState<SyncCommand | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<{
    success: boolean;
    duration: string;
  } | null>(null);
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

  const runSync = async (command: SyncCommand) => {
    if (running) return;

    setRunning(command);
    setLogs([]);
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/sync/${command}`, {
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

  return (
    <div>
      {/* Sync buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
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
        <div className="rounded-lg border border-gray-800 overflow-hidden">
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
    </div>
  );
}
