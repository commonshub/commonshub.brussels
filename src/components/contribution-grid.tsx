"use client";

import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MonthlyActivity {
  month: string;
  received: number;
  count: number;
  score: number;
  discordDays: number;
}

interface TokenData {
  walletAddress: string | null;
  balance: number;
  monthlyActivity: MonthlyActivity[];
  totalReceived: number;
  symbol: string;
  firstActivityDate: string | null;
}

interface ContributionGridProps {
  userId: string;
  onMonthSelect?: (month: string | null) => void;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function ContributionGrid({
  userId,
  onMonthSelect,
}: ContributionGridProps) {
  const [data, setData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/member/${userId}/tokens`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError("Could not load contribution data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-3"></div>
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-6 h-6 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const hasActivity = data.monthlyActivity.length > 0 || data.totalReceived > 0;

  if (!hasActivity && !data.walletAddress) {
    return null; // Don't show anything if no activity
  }

  const activityMap = new Map(data.monthlyActivity.map((m) => [m.month, m]));

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let startYear = currentYear;
  let startMonth = 0;

  if (data.firstActivityDate) {
    const firstDate = new Date(data.firstActivityDate);
    startYear = firstDate.getFullYear();
    startMonth = firstDate.getMonth();
  } else if (data.monthlyActivity.length > 0) {
    // Fallback to earliest month in activity
    const earliest = data.monthlyActivity[0].month;
    const [y, m] = earliest.split("-").map(Number);
    startYear = y;
    startMonth = m - 1;
  }

  const years: number[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    years.push(y);
  }

  const maxScore = Math.max(...data.monthlyActivity.map((m) => m.score), 1);

  const getIntensity = (score: number): string => {
    if (score === 0) return "bg-muted";
    const ratio = score / maxScore;
    if (ratio < 0.25) return "bg-primary/25";
    if (ratio < 0.5) return "bg-primary/50";
    if (ratio < 0.75) return "bg-primary/75";
    return "bg-primary";
  };

  const formatFirstActivityDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  };

  const handleMonthClick = (monthKey: string, hasActivity: boolean) => {
    if (!hasActivity) return;

    const newSelection = selectedMonth === monthKey ? null : monthKey;
    setSelectedMonth(newSelection);
    onMonthSelect?.(newSelection);
  };

  return (
    <div>
      <TooltipProvider>
        <div className="overflow-x-auto">
          <div className="flex gap-1 mb-1 ml-12">
            {MONTH_LABELS.map((label) => (
              <div
                key={label}
                className="w-6 text-[10px] text-muted-foreground text-center"
              >
                {label}
              </div>
            ))}
          </div>

          {years.map((year) => (
            <div key={year} className="flex gap-1 items-center mb-1">
              <div className="w-10 text-xs text-muted-foreground text-right pr-2">
                {year}
              </div>
              {MONTH_LABELS.map((_, monthIndex) => {
                const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
                const activity = activityMap.get(monthKey);
                const received = activity?.received || 0;
                const count = activity?.count || 0;
                const score = activity?.score || 0;
                const discordDays = activity?.discordDays || 0;

                const isFuture =
                  year > currentYear ||
                  (year === currentYear && monthIndex > currentMonth);
                // Check if this month is before first activity
                const isBeforeStart =
                  year < startYear ||
                  (year === startYear && monthIndex < startMonth);

                if (isFuture || isBeforeStart) {
                  return (
                    <div
                      key={monthKey}
                      className="w-6 h-6 rounded bg-transparent"
                    />
                  );
                }

                const isSelected = selectedMonth === monthKey;
                const hasActivity = score > 0;

                return (
                  <Tooltip key={monthKey}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleMonthClick(monthKey, hasActivity)}
                        className={`w-6 h-6 rounded transition-all ${
                          hasActivity
                            ? "cursor-pointer hover:ring-2 hover:ring-primary/50"
                            : "cursor-default"
                        } ${isSelected ? "ring-2 ring-primary" : ""} ${getIntensity(score)}`}
                        aria-label={`${MONTH_LABELS[monthIndex]} ${year}: ${received} ${data.symbol || "CHT"}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-center">
                        <p className="font-medium">
                          {MONTH_LABELS[monthIndex]} {year}
                        </p>
                        {score > 0 ? (
                          <>
                            {received > 0 && (
                              <p>
                                {received.toLocaleString()}{" "}
                                {data.symbol || "CHT"}
                              </p>
                            )}
                            {count > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {count} tx{count !== 1 ? "s" : ""}
                              </p>
                            )}
                            {discordDays > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {discordDays} active day
                                {discordDays !== 1 ? "s" : ""} on Discord
                              </p>
                            )}
                            <p className="text-xs font-medium mt-1">
                              Score: {score}
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">No activity</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </TooltipProvider>

      {(data.totalReceived > 0 || data.firstActivityDate) && (
        <p className="text-xs text-muted-foreground mt-3">
          {data.totalReceived > 0 && (
            <>
              Total earned: {data.totalReceived.toLocaleString()}{" "}
              {data.symbol || "CHT"}
            </>
          )}
          {data.firstActivityDate && (
            <> since {formatFirstActivityDate(data.firstActivityDate)}</>
          )}
        </p>
      )}
    </div>
  );
}
