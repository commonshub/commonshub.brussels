"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RoomEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  roomId: string;
}

interface CalendarData {
  events: RoomEvent[];
  range: {
    start: string;
    end: string;
  };
}

type DayStatus = "free" | "single" | "partial" | "busy";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Format date as YYYY-MM-DD in local timezone
function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface RoomEventData {
  id: string;
  start: string;
  end: string;
}

interface RoomMiniCalendarProps {
  roomId: string;
  onDateSelect?: (date: string | null, events: RoomEventData[]) => void;
}

export function RoomMiniCalendar({ roomId, onDateSelect }: RoomMiniCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data for the current month
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59);
        
        const response = await fetch(
          `/api/room-events?start=${start.toISOString()}&end=${end.toISOString()}`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch calendar data");
        }
        
        const result = await response.json();
        // Filter events for this room only
        result.events = result.events.filter((e: RoomEvent) => e.roomId === roomId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [currentDate.getFullYear(), currentDate.getMonth(), roomId]);

  // Calculate days in month and padding
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Monday = 0, Sunday = 6 (ISO week)
    let startPadding = firstDay.getDay() - 1;
    if (startPadding < 0) startPadding = 6;
    
    const days: (Date | null)[] = [];
    
    // Add padding for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentDate]);

  // Calculate booking density, events, and day status for each day
  const dayMetrics = useMemo(() => {
    if (!data) return new Map<string, { busyness: number; eventCount: number; status: DayStatus; events: RoomEvent[] }>();
    
    const metrics = new Map<string, { busyness: number; eventCount: number; status: DayStatus; events: RoomEvent[] }>();
    const availableHoursPerDay = 14; // 8am-10pm
    
    for (const day of calendarDays) {
      if (!day) continue;
      
      const dayKey = formatLocalDate(day);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      let totalBookedHours = 0;
      let eventCount = 0;
      const dayEvents: RoomEvent[] = [];
      
      for (const event of data.events) {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        
        if (eventStart <= dayEnd && eventEnd >= dayStart) {
          eventCount++;
          dayEvents.push(event);
          const overlapStart = eventStart < dayStart ? dayStart : eventStart;
          const overlapEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
          const hours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
          totalBookedHours += hours;
        }
      }

      const busyness = Math.min(1, totalBookedHours / availableHoursPerDay);
      let status: DayStatus = "free";

      if (eventCount === 0) {
        status = "free";
      } else if (busyness >= 0.65) {
        status = "busy";
      } else if (eventCount === 1) {
        status = "single";
      } else {
        status = "partial";
      }

      dayEvents.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      metrics.set(dayKey, { busyness, eventCount, status, events: dayEvents });
    }
    
    return metrics;
  }, [data, calendarDays]);

  // Get events for selected date
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate || !data) return [];
    
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const events = data.events.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return eventStart <= dayEnd && eventEnd >= dayStart;
    });
    
    // Sort by start time
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    return events;
  }, [selectedDate, data]);

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
  };

  const handleDateSelect = (day: Date) => {
    const isSameDate = selectedDate?.toDateString() === day.toDateString();
    if (isSameDate) {
      setSelectedDate(null);
      onDateSelect?.(null, []);
    } else {
      setSelectedDate(day);
      // Get events for this day
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayEvents = data?.events.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return eventStart <= dayEnd && eventEnd >= dayStart;
      }).map(e => ({ id: e.id, start: e.start, end: e.end })) || [];
      
      onDateSelect?.(formatLocalDate(day), dayEvents);
    }
  };

  const getDayStatusClass = (status: DayStatus) => {
    if (status === "free") {
      return "bg-emerald-300 text-emerald-950 hover:bg-emerald-400 dark:bg-emerald-800/70 dark:text-emerald-50 dark:hover:bg-emerald-700/80";
    }
    if (status === "busy") {
      return "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/15 dark:text-rose-100 dark:hover:bg-rose-900/25";
    }
    return "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/15 dark:text-amber-100 dark:hover:bg-amber-900/25";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-BE', { hour: '2-digit', minute: '2-digit' });
  };

  const getDayHoverText = (events: RoomEvent[]) => {
    if (events.length === 0) return "Available all day";
    return events
      .map((event) => `Booked between ${formatTime(event.start)} and ${formatTime(event.end)}`)
      .join("\n");
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isSelected = (date: Date) => {
    return selectedDate?.toDateString() === date.toDateString();
  };

  return (
    <div className="space-y-3">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" type="button" onClick={() => navigateMonth(-1)} className="cursor-pointer h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <Button variant="ghost" size="sm" type="button" onClick={goToToday} className="text-xs h-6 px-2 cursor-pointer">
            Today
          </Button>
        </div>
        
        <Button variant="ghost" size="icon" type="button" onClick={() => navigateMonth(1)} className="cursor-pointer h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-emerald-300 dark:bg-emerald-800/70" />
          <span className="text-muted-foreground">Free</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-amber-50 dark:bg-amber-950/15" />
          <span className="text-muted-foreground">One or some bookings</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-rose-50 dark:bg-rose-950/15" />
          <span className="text-muted-foreground">Mostly booked</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2">
          {loading ? (
            <div className="grid grid-cols-7 gap-0.5">
              {DAYS.map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day.charAt(0)}
                </div>
              ))}
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-destructive text-sm">{error}</div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5">
              {/* Day headers */}
              {DAYS.map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day.charAt(0)}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                
                const dayKey = formatLocalDate(day);
                const metrics = data
                  ? dayMetrics.get(dayKey) || { busyness: 0, eventCount: 0, status: "free" as DayStatus, events: [] }
                  : { busyness: 0, eventCount: 0, status: "free" as DayStatus, events: [] };
                const past = isPast(day);
                
                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => !past && handleDateSelect(day)}
                    disabled={past}
                    title={getDayHoverText(metrics.events)}
                    className={cn(
                      "aspect-square rounded flex items-center justify-center text-xs font-medium transition-colors relative",
                      past && "text-muted-foreground/50 cursor-not-allowed",
                      !past && data && getDayStatusClass(metrics.status),
                      !past && !data && "hover:bg-muted cursor-pointer",
                      !past && "cursor-pointer",
                      isSelected(day) && "ring-2 ring-primary ring-offset-1",
                      isToday(day) && "font-bold"
                    )}
                  >
                    {day.getDate()}
                    {isToday(day) && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected day events */}
      {selectedDate && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            {selectedDate.toLocaleDateString('en-BE', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
          
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✅ Available all day
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Booked times:</p>
              {selectedDayEvents.map(event => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1"
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    {formatTime(event.start)} - {formatTime(event.end)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
