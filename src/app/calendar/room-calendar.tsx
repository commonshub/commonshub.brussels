"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Users, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  capacity: number;
}

interface CalendarData {
  events: RoomEvent[];
  rooms: Room[];
  range: {
    start: string;
    end: string;
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function RoomCalendar() {
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
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

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

  // Calculate busyness for each day
  const dayBusyness = useMemo(() => {
    if (!data) return new Map<string, number>();
    
    const busyness = new Map<string, number>();
    const roomCount = data.rooms.length || 1;
    const availableHoursPerDay = roomCount * 14; // 8am-10pm
    
    for (const day of calendarDays) {
      if (!day) continue;
      
      const dayKey = day.toISOString().split('T')[0];
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      let totalBookedHours = 0;
      
      for (const event of data.events) {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        
        if (eventStart <= dayEnd && eventEnd >= dayStart) {
          const overlapStart = eventStart < dayStart ? dayStart : eventStart;
          const overlapEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
          const hours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
          totalBookedHours += hours;
        }
      }
      
      busyness.set(dayKey, Math.min(1, totalBookedHours / availableHoursPerDay));
    }
    
    return busyness;
  }, [data, calendarDays]);

  // Get events for selected date, grouped by room
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate || !data) return new Map<string, RoomEvent[]>();
    
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const eventsByRoom = new Map<string, RoomEvent[]>();
    
    // Initialize with all rooms
    for (const room of data.rooms) {
      eventsByRoom.set(room.id, []);
    }
    
    // Add events to their rooms
    for (const event of data.events) {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
      if (eventStart <= dayEnd && eventEnd >= dayStart) {
        const roomEvents = eventsByRoom.get(event.roomId) || [];
        roomEvents.push(event);
        eventsByRoom.set(event.roomId, roomEvents);
      }
    }
    
    // Sort events by start time
    for (const [roomId, events] of eventsByRoom) {
      events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    
    return eventsByRoom;
  }, [selectedDate, data]);

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
    setSelectedDate(null);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const getBusynessClass = (busyness: number) => {
    if (busyness < 0.3) return "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50";
    if (busyness < 0.6) return "bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50";
    return "bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50";
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-BE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (hours < 1) {
      return `${Math.round(hours * 60)}min`;
    }
    return `${hours.toFixed(1).replace('.0', '')}h`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return selectedDate?.toDateString() === date.toDateString();
  };

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/30" />
          <span className="text-muted-foreground">Partially booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
          <span className="text-muted-foreground">Busy</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {DAYS.map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                
                const dayKey = day.toISOString().split('T')[0];
                const busyness = dayBusyness.get(dayKey) || 0;
                const hasEvents = busyness > 0;
                
                return (
                  <button
                    key={dayKey}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-colors relative",
                      hasEvents ? getBusynessClass(busyness) : "hover:bg-muted",
                      isSelected(day) && "ring-2 ring-primary ring-offset-2",
                      isToday(day) && "font-bold"
                    )}
                  >
                    {day.getDate()}
                    {isToday(day) && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Day View */}
      {selectedDate && data && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {selectedDate.toLocaleDateString('en-BE', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
          
          {/* Room columns - horizontal scroll on mobile */}
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-4 min-w-max pb-4">
              {data.rooms.map(room => {
                const events = selectedDayEvents.get(room.id) || [];
                
                return (
                  <Card key={room.id} className="w-64 shrink-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{room.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {room.capacity}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {events.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Available all day
                        </p>
                      ) : (
                        events.map(event => (
                          <div
                            key={event.id}
                            className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1"
                          >
                            <div className="font-medium line-clamp-2">{event.title}</div>
                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatTime(event.start)} - {formatTime(event.end)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {formatDuration(event.start, event.end)}
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Event list for mobile */}
          <div className="md:hidden space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">All Events</h4>
            {Array.from(selectedDayEvents.entries()).flatMap(([roomId, events]) => 
              events.map(event => (
                <Card key={event.id} className="p-3">
                  <div className="font-medium">{event.title}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Badge variant="secondary" className="text-xs">{event.roomName}</Badge>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(event.start)} - {formatTime(event.end)}</span>
                    <span>({formatDuration(event.start, event.end)})</span>
                  </div>
                </Card>
              ))
            ).sort((a, b) => {
              const aTime = new Date((a.props.children[1].props.children[3].props.children as string)).getTime();
              const bTime = new Date((b.props.children[1].props.children[3].props.children as string)).getTime();
              return aTime - bTime;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
