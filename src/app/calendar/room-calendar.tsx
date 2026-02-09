"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users, Clock, Calendar as CalendarIcon, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmbeddedBookingForm } from "./embedded-booking-form";

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

// Format date as YYYY-MM-DD in local timezone
function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function RoomCalendar() {
  // Default to today selected
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
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
      
      const dayKey = formatLocalDate(day);
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

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
  };

  const handleBookingComplete = () => {
    setSelectedRoom(null);
  };

  // Determine current step
  const currentStep = !selectedDate ? 1 : !selectedRoom ? 2 : 3;

  return (
    <div className="space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 md:gap-4 text-sm">
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {currentStep > 1 ? <Check className="h-4 w-4" /> : <span className="font-semibold">1</span>}
          <span className="hidden sm:inline">Select a date</span>
        </div>
        <div className="h-px w-4 bg-border" />
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {currentStep > 2 ? <Check className="h-4 w-4" /> : <span className="font-semibold">2</span>}
          <span className="hidden sm:inline">Select a room</span>
        </div>
        <div className="h-px w-4 bg-border" />
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          currentStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <span className="font-semibold">3</span>
          <span className="hidden sm:inline">Submit booking</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Column 1: Calendar */}
        <div className="lg:w-72 xl:w-80 space-y-4 shrink-0">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)} className="cursor-pointer">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
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

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/30" />
              <span className="text-muted-foreground">Partial</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30" />
              <span className="text-muted-foreground">Busy</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <Card>
            <CardContent className="p-3">
              {loading ? (
                <div className="grid grid-cols-7 gap-1">
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
                <div className="text-center py-8 text-destructive text-sm">{error}</div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
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
                    // Only apply busyness colors when data is loaded
                    const busyness = data ? (dayBusyness.get(dayKey) || 0) : 0;
                    const hasEvents = data ? busyness > 0 : false;
                    
                    return (
                      <button
                        key={dayKey}
                        onClick={() => {
                          setSelectedDate(day);
                          setSelectedRoom(null);
                        }}
                        className={cn(
                          "aspect-square rounded flex items-center justify-center text-xs font-medium transition-colors relative cursor-pointer",
                          data && hasEvents ? getBusynessClass(busyness) : "hover:bg-muted",
                          isSelected(day) && "ring-2 ring-primary ring-offset-1",
                          isToday(day) && "font-bold"
                        )}
                      >
                        {day.getDate()}
                        {isToday(day) && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Rooms */}
        {selectedDate && data && (
          <div className="lg:w-72 xl:w-80 space-y-4 shrink-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {selectedDate.toLocaleDateString('en-BE', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </h3>
            
            {/* Room cards - vertical on desktop, horizontal scroll on mobile */}
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              {data.rooms.map(room => {
                const events = selectedDayEvents.get(room.id) || [];
                const isRoomSelected = selectedRoom?.id === room.id;
                
                return (
                  <Card 
                    key={room.id} 
                    className={cn(
                      "shrink-0 w-64 lg:w-full",
                      isRoomSelected && "ring-2 ring-primary"
                    )}
                  >
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {room.name}
                          <Link 
                            href={`/rooms/${room.slug || room.id}`}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                            title={`View ${room.name} details`}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </Link>
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {room.capacity}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      {events.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-1">
                          ✅ Available all day
                        </p>
                      ) : (
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {events.map(event => (
                            <div
                              key={event.id}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {formatTime(event.start)}-{formatTime(event.end)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <Button 
                        variant={isRoomSelected ? "default" : "outline"} 
                        size="sm" 
                        className="w-full text-xs cursor-pointer"
                        onClick={() => handleRoomSelect(room)}
                      >
                        {isRoomSelected ? "✓ Selected" : "Select this room"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Column 3: Booking Form */}
        {selectedDate && selectedRoom && (
          <div className="flex-1 min-w-0">
            <EmbeddedBookingForm
              roomId={selectedRoom.id}
              roomName={selectedRoom.name}
              date={formatLocalDate(selectedDate)}
              onComplete={handleBookingComplete}
              onBack={() => setSelectedRoom(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
