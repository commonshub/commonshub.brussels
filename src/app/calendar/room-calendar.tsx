"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RoomEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  roomId: string;
  roomName: string;
  roomCapacity: number;
}

interface Room {
  id: string;
  name: string;
  slug?: string;
  capacity: number;
}

interface CalendarData {
  events: RoomEvent[];
  rooms: Room[];
  range: { start: string; end: string };
}

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Stable room colors — order matches rooms.json
const ROOM_COLORS: Record<string, string> = {
  ostrom: "#6366f1",     // indigo
  satoshi: "#f59e0b",    // amber
  phonebooth: "#64748b", // slate
  angel: "#ec4899",      // pink
  mushroom: "#10b981",   // emerald
  coworking: "#3b82f6",  // blue
  playroom: "#f97316",   // orange
};

const ROOM_BG: Record<string, string> = {
  ostrom: "bg-indigo-500",
  satoshi: "bg-amber-500",
  phonebooth: "bg-slate-500",
  angel: "bg-pink-500",
  mushroom: "bg-emerald-500",
  coworking: "bg-blue-500",
  playroom: "bg-orange-500",
};

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function shortRoomName(name: string): string {
  return name.replace(/ Room$/, "").replace(/ Space$/, "");
}

export function RoomCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch events for visible range (may span prev/next month padding)
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        // Fetch a bit wider to cover padding days
        const start = new Date(year, month, -6);
        const end = new Date(year, month + 1, 7, 23, 59, 59);
        const res = await fetch(
          `/api/room-events?start=${start.toISOString()}&end=${end.toISOString()}`
        );
        if (!res.ok) throw new Error("fetch failed");
        setData(await res.json());
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  // Build calendar grid (6 rows × 7 cols)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    let startPadding = firstDay.getDay() - 1;
    if (startPadding < 0) startPadding = 6;

    const days: Date[] = [];
    // Start from (startPadding) days before the 1st
    const startDate = new Date(year, month, 1 - startPadding);
    // Always show 42 cells (6 weeks) for consistent layout
    for (let i = 0; i < 42; i++) {
      days.push(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
    }
    return days;
  }, [currentDate]);

  // Events indexed by date string
  const eventsByDay = useMemo(() => {
    if (!data) return new Map<string, RoomEvent[]>();
    const map = new Map<string, RoomEvent[]>();
    for (const ev of data.events) {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      // An event can span multiple days
      const d = new Date(start);
      d.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      while (d <= endDay) {
        const key = formatLocalDate(d);
        const arr = map.get(key) || [];
        arr.push(ev);
        map.set(key, arr);
        d.setDate(d.getDate() + 1);
      }
    }
    // Sort each day's events by start time
    for (const [, evs] of map) {
      evs.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    return map;
  }, [data]);

  // Hours booked per day (for mobile dots)
  const bookedHoursByDay = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const ev of data.events) {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      const hours = (end.getTime() - start.getTime()) / 3_600_000;
      const key = formatLocalDate(start);
      map.set(key, (map.get(key) || 0) + hours);
    }
    return map;
  }, [data]);

  const navigateMonth = useCallback((dir: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
  const isSelected = (d: Date) => d.toDateString() === selectedDate.toDateString();
  const isCurrentMonth = (d: Date) => d.getMonth() === currentDate.getMonth();

  // Selected day events for the detail panel (mobile + desktop)
  const selectedEvents = useMemo(() => {
    const key = formatLocalDate(selectedDate);
    return eventsByDay.get(key) || [];
  }, [selectedDate, eventsByDay]);

  // Busyness level for a day
  const getBusynessLevel = (dayKey: string): number => {
    const hours = bookedHoursByDay.get(dayKey) || 0;
    if (hours === 0) return 0;
    const roomCount = data?.rooms.length || 1;
    const totalAvail = roomCount * 14; // 8am-10pm
    return Math.min(1, hours / totalAvail);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} className="cursor-pointer">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-7 px-2 cursor-pointer">
            Today
          </Button>
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)} className="cursor-pointer">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Room legend */}
      {data && (
        <div className="flex flex-wrap gap-3 justify-center text-xs">
          {data.rooms.filter(r => r.id !== "coworking" && r.id !== "playroom").map((room) => (
            <div key={room.id} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded-full", ROOM_BG[room.id] || "bg-gray-400")} />
              <span className="text-muted-foreground">{shortRoomName(room.name)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {DAYS_SHORT.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2 border-b">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayKey = formatLocalDate(day);
            const events = eventsByDay.get(dayKey) || [];
            const inMonth = isCurrentMonth(day);
            const busyness = getBusynessLevel(dayKey);

            return (
              <button
                key={dayKey}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "relative border-b border-r min-h-[3rem] sm:min-h-[5.5rem] p-1 text-left transition-colors cursor-pointer",
                  "hover:bg-muted/50",
                  !inMonth && "opacity-40",
                  isSelected(day) && "bg-primary/5 ring-2 ring-inset ring-primary",
                  // On the last column, no right border
                  (i + 1) % 7 === 0 && "border-r-0",
                )}
              >
                {/* Day number */}
                <div className={cn(
                  "text-xs sm:text-sm font-medium leading-none mb-1",
                  isToday(day) && "text-primary font-bold",
                )}>
                  <span className={cn(
                    isToday(day) && "bg-primary text-primary-foreground rounded-full w-6 h-6 sm:w-7 sm:h-7 inline-flex items-center justify-center",
                  )}>
                    {day.getDate()}
                  </span>
                </div>

                {/* Desktop: show event list */}
                <div className="hidden sm:block space-y-0.5 overflow-hidden">
                  {events.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-1 text-[10px] leading-tight truncate"
                      title={`${formatTime(ev.start)}-${formatTime(ev.end)} ${ev.title}`}
                    >
                      <span
                        className={cn("w-1.5 h-1.5 rounded-full shrink-0", ROOM_BG[ev.roomId] || "bg-gray-400")}
                      />
                      <span className="text-muted-foreground">{formatTime(ev.start)}</span>
                      <span className="truncate">{ev.title || shortRoomName(ev.roomName)}</span>
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{events.length - 3} more
                    </div>
                  )}
                </div>

                {/* Mobile: color dots indicating busyness */}
                <div className="sm:hidden flex justify-center gap-0.5 mt-0.5">
                  {events.length > 0 && (
                    <>
                      {/* Show up to 3 colored dots for unique rooms with events */}
                      {[...new Set(events.map((e) => e.roomId))].slice(0, 3).map((roomId) => (
                        <span
                          key={roomId}
                          className={cn("w-1.5 h-1.5 rounded-full", ROOM_BG[roomId] || "bg-gray-400")}
                        />
                      ))}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      <SelectedDayPanel
        date={selectedDate}
        events={selectedEvents}
        rooms={data?.rooms || []}
      />
    </div>
  );
}

function SelectedDayPanel({
  date,
  events,
  rooms,
}: {
  date: Date;
  events: RoomEvent[];
  rooms: Room[];
}) {
  const dateStr = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm sm:text-base">{dateStr}</h3>
        <Link
          href={`/book?date=${formatLocalDate(date)}`}
          className="text-xs text-primary hover:underline font-medium"
        >
          Book this day →
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No bookings — all rooms available
        </p>
      ) : (
        <div className="space-y-1.5">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 text-sm">
              <span
                className={cn("w-2.5 h-2.5 rounded-full shrink-0", ROOM_BG[ev.roomId] || "bg-gray-400")}
                title={ev.roomName}
              />
              <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                {formatTime(ev.start)}–{formatTime(ev.end)}
              </span>
              <span className="text-muted-foreground text-xs">[{shortRoomName(ev.roomName)}]</span>
              <span className="truncate">{ev.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
