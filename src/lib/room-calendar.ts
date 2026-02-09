/**
 * Room Calendar utilities
 * Fetches events from Google Calendar ICS feeds for each room
 */

import roomsData from "@/settings/rooms.json";

export interface RoomEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  roomId: string;
  roomName: string;
  roomCapacity: number;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  googleCalendarId: string | null;
}

/**
 * Get Google Calendar ICS URL from calendar ID
 */
function getGoogleCalendarUrl(calendarId: string): string {
  const encodedId = encodeURIComponent(calendarId);
  return `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
}

/**
 * Parse ICS date string to Date object
 */
function parseIcsDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Handle different ICS date formats
  // DTSTART:20260206T100000Z (UTC)
  // DTSTART;TZID=Europe/Brussels:20260206T100000
  // DTSTART;VALUE=DATE:20260206 (all-day event)
  
  const cleanStr = dateStr.replace(/^(DTSTART|DTEND)[^:]*:/, '');
  
  // All-day event (just date, no time)
  if (/^\d{8}$/.test(cleanStr)) {
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    return new Date(year, month, day);
  }
  
  // Date with time
  const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (match) {
    const [, year, month, day, hour, minute, second, isUtc] = match;
    if (isUtc) {
      return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      ));
    } else {
      // Assume local time (Brussels)
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
    }
  }
  
  return null;
}

/**
 * Parse ICS content and extract events
 */
function parseIcsEvents(icsContent: string, roomId: string, roomName: string, roomCapacity: number): RoomEvent[] {
  const events: RoomEvent[] = [];
  
  // Split by VEVENT blocks
  const eventBlocks = icsContent.split('BEGIN:VEVENT');
  
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split('END:VEVENT')[0];
    
    // Extract fields - handle multi-line values (lines starting with space are continuations)
    const lines = block.split(/\r?\n/);
    const fields: Record<string, string> = {};
    let currentField = '';
    let currentValue = '';
    
    for (const line of lines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        // Continuation of previous line
        currentValue += line.substring(1);
      } else {
        // Save previous field
        if (currentField) {
          fields[currentField] = currentValue;
        }
        // Start new field
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          currentField = line.substring(0, colonIndex).split(';')[0]; // Remove parameters
          currentValue = line.substring(colonIndex + 1);
        }
      }
    }
    // Save last field
    if (currentField) {
      fields[currentField] = currentValue;
    }
    
    const uid = fields['UID'] || `${roomId}-${i}`;
    const summary = (fields['SUMMARY'] || 'Untitled Event')
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';');
    const description = (fields['DESCRIPTION'] || '')
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';');
    
    // Find DTSTART and DTEND in original block (to preserve parameters)
    const dtStartLine = block.match(/DTSTART[^:]*:[^\r\n]+/)?.[0] || '';
    const dtEndLine = block.match(/DTEND[^:]*:[^\r\n]+/)?.[0] || '';
    
    const start = parseIcsDate(dtStartLine);
    const end = parseIcsDate(dtEndLine);
    
    if (start && end) {
      events.push({
        id: uid,
        title: summary,
        description: description || undefined,
        start,
        end,
        roomId,
        roomName,
        roomCapacity,
      });
    }
  }
  
  return events;
}

/**
 * Fetch events for a single room
 */
async function fetchRoomEvents(room: Room): Promise<RoomEvent[]> {
  if (!room.googleCalendarId) {
    return [];
  }
  
  try {
    const url = getGoogleCalendarUrl(room.googleCalendarId);
    const response = await fetch(url, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch calendar for ${room.name}: ${response.statusText}`);
      return [];
    }
    
    const icsContent = await response.text();
    return parseIcsEvents(icsContent, room.id, room.name, room.capacity);
  } catch (error) {
    console.error(`Error fetching calendar for ${room.name}:`, error);
    return [];
  }
}

/**
 * Fetch events for all rooms
 */
export async function fetchAllRoomEvents(): Promise<RoomEvent[]> {
  const rooms = roomsData.rooms.filter(room => room.googleCalendarId) as Room[];
  
  const eventPromises = rooms.map(room => fetchRoomEvents(room));
  const eventArrays = await Promise.all(eventPromises);
  
  // Flatten and sort by start time
  const allEvents = eventArrays.flat();
  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  return allEvents;
}

/**
 * Fetch events for a specific date range
 */
export async function fetchRoomEventsForRange(
  startDate: Date,
  endDate: Date
): Promise<RoomEvent[]> {
  const allEvents = await fetchAllRoomEvents();
  
  return allEvents.filter(event => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    // Event overlaps with the range
    return eventStart < endDate && eventEnd > startDate;
  });
}

/**
 * Get rooms sorted by capacity (descending)
 */
export function getRoomsSortedByCapacity(): Room[] {
  return (roomsData.rooms as Room[])
    .filter(room => room.googleCalendarId)
    .sort((a, b) => b.capacity - a.capacity);
}

/**
 * Calculate busyness for a day (0-1 scale)
 * Based on total booked hours vs available hours (8am-10pm = 14 hours)
 */
export function calculateDayBusyness(events: RoomEvent[], date: Date): number {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  
  const rooms = getRoomsSortedByCapacity();
  const totalAvailableHours = rooms.length * 14; // 14 hours per room (8am-10pm)
  
  if (totalAvailableHours === 0) return 0;
  
  let totalBookedHours = 0;
  
  for (const event of events) {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    
    // Check if event is on this day
    if (eventStart <= dayEnd && eventEnd >= dayStart) {
      // Calculate overlap with this day
      const overlapStart = eventStart < dayStart ? dayStart : eventStart;
      const overlapEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
      const hours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
      totalBookedHours += hours;
    }
  }
  
  return Math.min(1, totalBookedHours / totalAvailableHours);
}

/**
 * Get busyness color based on ratio
 */
export function getBusynessColor(busyness: number): string {
  if (busyness < 0.3) return 'bg-green-100 dark:bg-green-900/30';
  if (busyness < 0.6) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}
