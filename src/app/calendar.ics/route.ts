import { NextResponse } from "next/server";
import roomsData from "@/settings/rooms.json";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes

const LOCATION = "Commons Hub Brussels, Rue de la Madeleine 51, 1000 Brussels";
const OUTSIDE_CALENDAR_ID =
  "c_c5c032ff4f13c1066827b469a731dca1bc416bf6ccd736adc267c79b95de6a6a@group.calendar.google.com";

interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  dtstartLine: string; // Full line e.g. "DTSTART;TZID=Europe/Brussels:20260301T140000"
  dtendLine: string;
  dtstartValue: string; // Just the value for sorting
  location: string;
  url?: string;
}

/**
 * Fetch and parse events from a Google Calendar ICS feed.
 * Returns raw VEVENT blocks with room info injected.
 */
async function fetchCalendarEvents(
  calendarId: string,
  roomName: string
): Promise<IcsEvent[]> {
  const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;

  try {
    const res = await fetch(icsUrl, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error(`Failed to fetch ICS for ${roomName}: ${res.status}`);
      return [];
    }
    const icsContent = await res.text();
    return parseIcsToEvents(icsContent, roomName);
  } catch (error) {
    console.error(`Error fetching ICS for ${roomName}:`, error);
    return [];
  }
}

function parseIcsToEvents(icsContent: string, roomName: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const blocks = icsContent.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const fields = parseIcsFields(block);

    const uid = fields["UID"] || `event-${i}`;
    const summary = unescapeIcs(fields["SUMMARY"] || "Untitled");
    const rawDesc = unescapeIcs(fields["DESCRIPTION"] || "");
    const sourceUrl = fields["URL"] || undefined;

    // Extract full DTSTART/DTEND lines preserving timezone params
    const dtstartLine = extractRawLine(block, "DTSTART");
    const dtendLine = extractRawLine(block, "DTEND");
    if (!dtstartLine || !dtendLine) continue;

    // Extract just the value for sorting
    const dtstartValue = dtstartLine.split(":").slice(1).join(":");

    // Also check description for "Event URL:"
    let eventUrl = sourceUrl;
    if (!eventUrl && rawDesc) {
      const m = rawDesc.match(/Event URL: (https?:\/\/\S+)/);
      if (m) eventUrl = m[1];
    }

    // Build description: room name + original description (cleaned)
    let description = `Room: ${roomName}`;
    // Strip internal metadata from description
    const cleanDesc = rawDesc
      .replace(/User ID: .*/g, "")
      .replace(/Booking TX: .*/g, "")
      .replace(/Booking Chain: .*/g, "")
      .replace(/Event URL: .*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleanDesc) {
      description += `\n\n${cleanDesc}`;
    }

    events.push({
      uid,
      summary,
      description,
      dtstartLine,
      dtendLine,
      dtstartValue,
      location: LOCATION,
      url: eventUrl,
    });
  }

  return events;
}

function parseIcsFields(block: string): Record<string, string> {
  const lines = block.split(/\r?\n/);
  const fields: Record<string, string> = {};
  let currentField = "";
  let currentValue = "";

  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      currentValue += line.substring(1);
    } else {
      if (currentField) {
        fields[currentField] = currentValue;
      }
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        // Strip parameters (e.g. DTSTART;TZID=... → DTSTART)
        const key = line.substring(0, colonIdx).split(";")[0];
        currentField = key;
        currentValue = line.substring(colonIdx + 1);
      } else {
        currentField = "";
        currentValue = "";
      }
    }
  }
  if (currentField) {
    fields[currentField] = currentValue;
  }
  return fields;
}

// Extract a raw ICS line preserving parameters (e.g. DTSTART;TZID=Europe/Brussels:20260301T140000)
// Handles line folding (continuation lines starting with space)
function extractRawLine(block: string, field: string): string | null {
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(field)) {
      let value = lines[i];
      // Unfold continuation lines
      while (i + 1 < lines.length && (lines[i + 1].startsWith(" ") || lines[i + 1].startsWith("\t"))) {
        i++;
        value += lines[i].substring(1);
      }
      return value;
    }
  }
  return null;
}

function unescapeIcs(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Fold long ICS lines at 75 octets
function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) return line;
  let result = line.substring(0, maxLen);
  let pos = maxLen;
  while (pos < line.length) {
    result += "\r\n " + line.substring(pos, pos + maxLen - 1);
    pos += maxLen - 1;
  }
  return result;
}

export async function GET() {
  // Collect all calendars: rooms + outside
  const calendars: { calendarId: string; roomName: string }[] = [];

  for (const room of roomsData.rooms) {
    if (room.googleCalendarId) {
      calendars.push({ calendarId: room.googleCalendarId, roomName: room.name });
    }
  }

  // Add outside calendar
  calendars.push({ calendarId: OUTSIDE_CALENDAR_ID, roomName: "Outside" });

  // Fetch all events in parallel
  const eventArrays = await Promise.all(
    calendars.map((c) => fetchCalendarEvents(c.calendarId, c.roomName))
  );
  const allEvents = eventArrays.flat();

  // Sort by DTSTART value
  allEvents.sort((a, b) => a.dtstartValue.localeCompare(b.dtstartValue));

  // Build ICS
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Commons Hub Brussels//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Commons Hub Brussels",
    "X-WR-TIMEZONE:Europe/Brussels",
  ];

  for (const ev of allEvents) {
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${ev.uid}`));
    lines.push(foldLine(`SUMMARY:${escapeIcs(ev.summary)}`));
    lines.push(foldLine(`DESCRIPTION:${escapeIcs(ev.description)}`));
    lines.push(foldLine(`LOCATION:${escapeIcs(ev.location)}`));
    lines.push(foldLine(ev.dtstartLine));
    lines.push(foldLine(ev.dtendLine));
    if (ev.url) {
      lines.push(foldLine(`URL:${ev.url}`));
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n") + "\r\n";

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="commons-hub-brussels.ics"',
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
