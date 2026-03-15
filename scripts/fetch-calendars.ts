/**
 * Fetch events from iCal and Luma API
 * Saves raw data to cache files for later processing
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import ical from "node-ical";
import settings from "../src/settings/settings.json";
import roomsData from "../src/settings/rooms.json";
import { getAllCalendarEvents } from "../src/lib/luma";
import ogs from "open-graph-scraper";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FORCE_FETCH = process.argv.includes("--force");

// Get month range from command line arguments (--month=YYYY-MM or --start-month=YYYY-MM --end-month=YYYY-MM)
const monthArg = process.argv.find((arg) => arg.startsWith("--month="));
const startMonthArg = process.argv.find((arg) =>
  arg.startsWith("--start-month=")
);
const endMonthArg = process.argv.find((arg) => arg.startsWith("--end-month="));

const FILTER_MONTH = monthArg ? monthArg.split("=")[1] : null;
const START_MONTH = startMonthArg ? startMonthArg.split("=")[1] : null;
const END_MONTH = endMonthArg ? endMonthArg.split("=")[1] : null;

export interface FetchCalendarsOptions {
  dataDir?: string;
  forceFetch?: boolean;
  filterMonth?: string | null;
  startMonth?: string | null;
  endMonth?: string | null;
  quiet?: boolean;
}

export interface FetchCalendarsResult {
  affectedMonths: string[];
  totalEvents: number;
  upcomingEvents: number;
}

/**
 * Check if a month should be processed based on filter parameters
 */
function shouldProcessMonth(yearMonth: string): boolean {
  if (FILTER_MONTH) {
    return yearMonth === FILTER_MONTH;
  }
  if (START_MONTH && yearMonth < START_MONTH) {
    return false;
  }
  if (END_MONTH && yearMonth > END_MONTH) {
    return false;
  }
  return true;
}

function shouldProcessMonthWithOpts(
  yearMonth: string,
  opts: FetchCalendarsOptions
): boolean {
  if (opts.filterMonth) {
    return yearMonth === opts.filterMonth;
  }
  if (opts.startMonth && yearMonth < opts.startMonth) {
    return false;
  }
  if (opts.endMonth && yearMonth > opts.endMonth) {
    return false;
  }
  return true;
}

/**
 * Download an image from a URL
 */
function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        } else {
          fs.unlink(filepath, () => {});
          reject(new Error(`Failed to download: ${response.statusCode}`));
        }
      })
      .on("error", (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
  });
}

/**
 * Construct Google Calendar ICS URL from calendar ID
 */
function getGoogleCalendarUrl(calendarId: string): string {
  // URL-encode the calendar ID (it may contain @ and other special chars)
  const encodedId = encodeURIComponent(calendarId);
  return `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
}

/**
 * Get file extension from URL
 */
function getExtensionFromUrl(url: string): string {
  const urlParts = url.split("/");
  const filename = urlParts[urlParts.length - 1].split("?")[0];
  const ext = path.extname(filename);
  return ext || ".jpg";
}

/**
 * Fetch og:image from a URL
 */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const { result } = await ogs({ url });
    if (result.success && result.ogImage && result.ogImage.length > 0) {
      return result.ogImage[0].url;
    }
  } catch (error) {
    // Silently fail
  }
  return null;
}

/**
 * Get all month directories in the data folder
 */
function getAllMonths(): Array<{ year: string; month: string }> {
  const months: Array<{ year: string; month: string }> = [];

  if (!fs.existsSync(DATA_DIR)) {
    return months;
  }

  const yearDirs = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  for (const year of yearDirs) {
    const yearPath = path.join(DATA_DIR, year);
    const monthDirs = fs
      .readdirSync(yearPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
      .map((dirent) => dirent.name)
      .sort();

    for (const month of monthDirs) {
      months.push({ year, month });
    }
  }

  return months;
}

/**
 * Fetch iCal and split by month
 */
async function fetchAndSplitICal() {
  const icalUrl = (settings.luma as any)?.icalUrl;
  if (!icalUrl) {
    console.error("No iCal URL found in settings.json");
    return;
  }

  console.log("Fetching iCal feed...");
  const response = await fetch(icalUrl);
  const icalData = await response.text();

  console.log("Parsing iCal events...");
  const events = await ical.async.parseICS(icalData);

  // Group events by year-month
  const eventsByMonth = new Map<string, string[]>();

  // Split the original iCal data by events
  const icalLines = icalData.split("\n");
  let currentEvent: string[] = [];
  let inEvent = false;
  const eventBlocks = new Map<string, string[]>();

  for (const line of icalLines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      currentEvent = [line];
    } else if (line.startsWith("END:VEVENT")) {
      currentEvent.push(line);
      const eventText = currentEvent.join("\n");
      // Extract UID to match with parsed events
      const uidMatch = eventText.match(/UID:([^\r\n]+)/);
      if (uidMatch) {
        eventBlocks.set(uidMatch[1], currentEvent);
      }
      inEvent = false;
      currentEvent = [];
    } else if (inEvent) {
      currentEvent.push(line);
    }
  }

  // Group events by month
  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== "VEVENT") continue;

    const startDate = event.start;
    if (!startDate) continue;

    const yearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

    if (!eventsByMonth.has(yearMonth)) {
      eventsByMonth.set(yearMonth, []);
    }

    const eventLines = eventBlocks.get(uid);
    if (eventLines) {
      eventsByMonth.get(yearMonth)!.push(eventLines.join("\n"));
    }
  }

  console.log(`Found events in ${eventsByMonth.size} different months\n`);

  // Save as iCal files for each month
  for (const [yearMonth, monthEventBlocks] of eventsByMonth.entries()) {
    // Skip months outside the filter range
    if (!shouldProcessMonth(yearMonth)) {
      continue;
    }

    const [year, month] = yearMonth.split("-");
    const icalDir = path.join(DATA_DIR, year, month, "calendars", "ical");
    const icsPath = path.join(icalDir, "calendar.ics");

    // Skip if already exists (unless force flag is set)
    if (!FORCE_FETCH && fs.existsSync(icsPath)) {
      console.log(
        `⊘ Skipping ${yearMonth} iCal (already exists, use --force to override)`
      );
      continue;
    }

    if (!fs.existsSync(icalDir)) {
      fs.mkdirSync(icalDir, { recursive: true });
    }

    // Create a proper iCal file with header and footer
    const icalContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Commons Hub Brussels//Events//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...monthEventBlocks,
      "END:VCALENDAR",
    ].join("\n");

    fs.writeFileSync(icsPath, icalContent, "utf-8");

    console.log(
      `✓ Saved ${monthEventBlocks.length} events to ${year}/${month}/calendars/ical/calendar.ics`
    );
  }
}

/**
 * Fetch and split calendar URL by month
 */
async function fetchAndSplitCalendarURL(
  url: string,
  calendarName: string,
  opts: { quiet?: boolean } = {}
): Promise<{ totalEvents: number; upcomingEvents: number }> {
  if (!opts.quiet) console.log(`Fetching ${calendarName} calendar from ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `  Failed to fetch ${calendarName} calendar: ${response.statusText}`
      );
      return { totalEvents: 0, upcomingEvents: 0 };
    }

    const icalData = await response.text();
    if (!opts.quiet) console.log(`Parsing ${calendarName} events...`);
    const events = await ical.async.parseICS(icalData);

    // Group events by year-month
    const eventsByMonth = new Map<string, string[]>();

    // Split the original iCal data by events
    const icalLines = icalData.split("\n");
    let currentEvent: string[] = [];
    let inEvent = false;
    const eventBlocks = new Map<string, string[]>();

    for (const line of icalLines) {
      if (line.startsWith("BEGIN:VEVENT")) {
        inEvent = true;
        currentEvent = [line];
      } else if (line.startsWith("END:VEVENT")) {
        currentEvent.push(line);
        const eventText = currentEvent.join("\n");
        // Extract UID to match with parsed events
        const uidMatch = eventText.match(/UID:([^\r\n]+)/);
        if (uidMatch) {
          eventBlocks.set(uidMatch[1], currentEvent);
        }
        inEvent = false;
        currentEvent = [];
      } else if (inEvent) {
        currentEvent.push(line);
      }
    }

    // Group events by month
    for (const [uid, event] of Object.entries(events)) {
      if (event.type !== "VEVENT") continue;

      const startDate = event.start;
      if (!startDate) continue;

      const yearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

      if (!eventsByMonth.has(yearMonth)) {
        eventsByMonth.set(yearMonth, []);
      }

      const eventLines = eventBlocks.get(uid);
      if (eventLines) {
        eventsByMonth.get(yearMonth)!.push(eventLines.join("\n"));
      }
    }

    if (!opts.quiet) console.log(
      `Found ${Object.keys(events).length} events across ${eventsByMonth.size} different months\n`
    );

    // Count total and upcoming events
    const now = new Date();
    let totalEvents = 0;
    let upcomingEvents = 0;
    for (const [uid, event] of Object.entries(events)) {
      if (event.type !== "VEVENT") continue;
      totalEvents++;
      if (event.start && new Date(event.start as any) >= now) {
        upcomingEvents++;
      }
    }

    // Save as iCal files for each month
    const calendarSlug = calendarName.toLowerCase().replace(/\s+/g, "-");
    for (const [yearMonth, monthEventBlocks] of eventsByMonth.entries()) {
      // Skip months outside the filter range
      if (!shouldProcessMonth(yearMonth)) {
        continue;
      }

      const [year, month] = yearMonth.split("-");
      const icsDir = path.join(DATA_DIR, year, month, "calendars", "ics");
      const icsPath = path.join(icsDir, `${calendarSlug}.ics`);

      // Skip if already exists (unless force flag is set)
      if (!FORCE_FETCH && fs.existsSync(icsPath)) {
        if (!opts.quiet) console.log(
          `⊘ Skipping ${yearMonth} ${calendarName} (already exists, use --force to override)`
        );
        continue;
      }

      if (!fs.existsSync(icsDir)) {
        fs.mkdirSync(icsDir, { recursive: true });
      }

      // Create a proper iCal file with header and footer
      const icalContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        `PRODID:-//Commons Hub Brussels//${calendarName}//EN`,
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        ...monthEventBlocks,
        "END:VCALENDAR",
      ].join("\n");

      fs.writeFileSync(icsPath, icalContent, "utf-8");

      if (!opts.quiet) console.log(
        `✓ Saved ${monthEventBlocks.length} ${calendarName} events to ${year}/${month}/calendars/ics/${calendarSlug}.ics`
      );
    }

    // Download images for events with URLs
    if (!opts.quiet) console.log(`\nDownloading ${calendarName} event images...`);
    for (const [yearMonth, monthEventBlocks] of eventsByMonth.entries()) {
      // Skip months outside the filter range
      if (!shouldProcessMonth(yearMonth)) {
        continue;
      }

      const [year, month] = yearMonth.split("-");

      // Filter events for this month
      const monthEvents = Object.entries(events).filter(([uid, event]) => {
        if (event.type !== "VEVENT") return false;
        const startDate = event.start;
        if (!startDate) return false;
        const eventYearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
        return eventYearMonth === yearMonth;
      });

      if (monthEvents.length > 0) {
        const monthEventsObj = Object.fromEntries(monthEvents);
        await downloadCalendarImages(year, month, monthEventsObj);
      }
    }
    return { totalEvents, upcomingEvents };
  } catch (error) {
    console.error(`Error fetching ${calendarName} calendar:`, error);
    return { totalEvents: 0, upcomingEvents: 0 };
  }
}

/**
 * Download images for calendar events (from URL og:image)
 */
async function downloadCalendarImages(
  year: string,
  month: string,
  events: any[]
): Promise<void> {
  const imagesDir = path.join(
    DATA_DIR,
    year,
    month,
    "calendars",
    "ics",
    "images"
  );
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  let downloadedCount = 0;
  for (const [uid, event] of Object.entries(events)) {
    if (event.type !== "VEVENT") continue;

    // Try to get URL from event.url or event.location (some events put URLs in location field)
    let eventUrl = event.url;

    // If no URL field, check if location contains a URL
    if (!eventUrl && event.location && typeof event.location === "string") {
      // Check if location starts with http:// or https://
      const locationStr = event.location.trim();
      if (locationStr.match(/^https?:\/\//)) {
        // Extract just the URL part (in case there's text after)
        const urlMatch = locationStr.match(/^(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          eventUrl = urlMatch[1];
        }
      }
    }

    if (!eventUrl || typeof eventUrl !== "string") continue;

    // Clean up URL - remove any trailing spaces or invalid characters
    eventUrl = eventUrl.trim();

    try {
      // Fetch og:image from event URL
      if (process.env.DEBUG) {
        console.log(`  → Fetching og:image from: ${eventUrl}`);
      }
      const ogImageUrl = await fetchOgImage(eventUrl);
      if (ogImageUrl) {
        // Convert relative URLs to absolute URLs
        let absoluteImageUrl = ogImageUrl;
        if (ogImageUrl.startsWith("/")) {
          // Relative URL - prepend the base URL
          const urlObj = new URL(eventUrl);
          absoluteImageUrl = `${urlObj.protocol}//${urlObj.host}${ogImageUrl}`;
        }

        if (process.env.DEBUG) {
          console.log(`  ✓ Found og:image: ${absoluteImageUrl}`);
        }

        // Create a safe filename from the UID
        const safeUid = uid.replace(/[^a-zA-Z0-9-]/g, "_");
        const ext = getExtensionFromUrl(absoluteImageUrl);
        const imagePath = path.join(imagesDir, `${safeUid}${ext}`);

        // Skip if already exists
        if (!fs.existsSync(imagePath)) {
          await downloadImage(absoluteImageUrl, imagePath);
          downloadedCount++;
        }
      } else if (process.env.DEBUG) {
        console.log(`  ⊘ No og:image found for ${eventUrl}`);
      }
    } catch (error) {
      // Log errors in development for debugging
      if (process.env.DEBUG) {
        console.error(
          `  ⚠ Failed to download image for ${uid} (${eventUrl}):`,
          error
        );
      }
    }
  }

  if (downloadedCount > 0) {
    console.log(`  ✓ Downloaded ${downloadedCount} calendar event images`);
  }
}

/**
 * Fetch and save Luma API data for a month
 */
async function fetchLumaForMonth(year: string, month: string, opts: { quiet?: boolean } = {}) {
  const calendarId = (settings.luma as any)?.calendarId;

  if (!calendarId) {
    return;
  }

  if (!process.env.LUMA_API_KEY) {
    return;
  }

  // Check if data already exists (unless force flag is set)
  const lumaDir = path.join(DATA_DIR, year, month, "calendars", "luma");
  const lumaPath = path.join(lumaDir, `${calendarId}.json`);

  if (!FORCE_FETCH && fs.existsSync(lumaPath)) {
    if (!opts.quiet) console.log(
      `⊘ Skipping ${year}-${month} Luma API (already exists, use --force to override)`
    );
    return;
  }

  try {
    // Calculate date range
    const monthStart = `${year}-${month}-01T00:00:00Z`;
    const nextMonth =
      month === "12" ? "01" : String(parseInt(month) + 1).padStart(2, "0");
    const nextYear = month === "12" ? String(parseInt(year) + 1) : year;
    const monthEnd = `${nextYear}-${nextMonth}-01T00:00:00Z`;

    // Fetch from Luma API
    const entries = await getAllCalendarEvents(
      calendarId,
      monthStart,
      monthEnd
    );

    // Flatten event structure - the API returns { api_id, event: {...}, tags }
    // We need to extract and flatten the nested event data
    const events = entries.map((entry: any) => ({
      ...entry.event,
      api_id: entry.api_id || entry.event?.api_id,
      tags: entry.tags,
    }));

    // Save to cache
    if (!fs.existsSync(lumaDir)) {
      fs.mkdirSync(lumaDir, { recursive: true });
    }

    fs.writeFileSync(lumaPath, JSON.stringify(events, null, 2), "utf-8");

    if (events.length > 0 && !opts.quiet) {
      console.log(`  ✓ Saved ${events.length} Luma events`);
    }

    // Fetch and save guests for each event
    const guestsDir = path.join(lumaDir, "private", "guests");
    if (!fs.existsSync(guestsDir)) {
      fs.mkdirSync(guestsDir, { recursive: true });
    }

    for (const event of events) {
      if (event.api_id) {
        try {
          const { getEventGuests } = await import("../lib/luma");
          const guests = await getEventGuests(event.api_id);

          // Clean up eventId - remove @events.lu.ma suffix
          const cleanEventId = event.api_id.replace(/@events\.lu\.ma$/, "");
          const guestsPath = path.join(guestsDir, `${cleanEventId}.json`);
          fs.writeFileSync(
            guestsPath,
            JSON.stringify(guests, null, 2),
            "utf-8"
          );
        } catch (error) {
          // Silently fail for individual guest fetches
        }
      }
    }

    // Download cover images for Luma events
    const imagesDir = path.join(lumaDir, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    let downloadedCount = 0;
    for (const event of events) {
      if (event.cover_url) {
        try {
          // Clean up eventId - remove @events.lu.ma suffix
          const cleanEventId = event.api_id.replace(/@events\.lu\.ma$/, "");
          const ext = getExtensionFromUrl(event.cover_url);
          const imagePath = path.join(imagesDir, `${cleanEventId}${ext}`);

          // Skip if already exists
          if (!fs.existsSync(imagePath)) {
            await downloadImage(event.cover_url, imagePath);
            downloadedCount++;
          }
        } catch (error) {
          // Silently fail for individual image downloads
        }
      }
    }

    if (downloadedCount > 0 && !opts.quiet) {
      console.log(`  ✓ Downloaded ${downloadedCount} Luma event images`);
    }
  } catch (error) {
    // Silently fail for Luma API - not critical
  }
}

/**
 * Run the full calendar fetch pipeline with options.
 * Exported for use by the CLI tool.
 */
export async function fetchCalendars(
  opts: FetchCalendarsOptions = {}
): Promise<string[]> {
  const dataDir = opts.dataDir || DATA_DIR;
  const forceFetch = opts.forceFetch ?? FORCE_FETCH;

  // Temporarily override module-level vars for the existing functions
  const origDataDir = (globalThis as any).__fetchCal_dataDir;
  const origForce = (globalThis as any).__fetchCal_force;

  console.log("📅 Starting events fetch...");
  console.log(`📂 DATA_DIR: ${dataDir}\n`);

  // Fetch calendar URLs from settings
  const calendars = (settings as any).calendars || {};
  const lumaIcsUrl = calendars.luma;
  const googleIcsUrl = calendars.google;

  // Fetch and split calendar URLs by month
  if (lumaIcsUrl) {
    await fetchAndSplitCalendarURL(lumaIcsUrl, "Luma", { quiet: opts.quiet });
  }

  if (googleIcsUrl) {
    await fetchAndSplitCalendarURL(googleIcsUrl, "Google", { quiet: opts.quiet });
  }

  // Fetch room calendars from rooms.json
  const roomsWithCalendars = roomsData.rooms.filter(
    (room) => room.googleCalendarId
  );

  if (roomsWithCalendars.length > 0) {
    console.log(`\nFetching ${roomsWithCalendars.length} room calendar(s)...`);

    for (const room of roomsWithCalendars) {
      if (room.googleCalendarId) {
        const calendarUrl = getGoogleCalendarUrl(room.googleCalendarId);
        await fetchAndSplitCalendarURL(calendarUrl, room.slug, { quiet: opts.quiet });
      }
    }
  }

  // Fetch and split main iCal feed by month (if configured)
  const mainIcalUrl = (settings.luma as any)?.icalUrl;
  if (mainIcalUrl) {
    await fetchAndSplitICal();
  }

  // Get all months that now have calendar data
  const months = getAllMonths();

  if (months.length === 0) {
    console.log("\nNo month directories found.");
    return [];
  }

  // Filter months
  let monthsToProcess = months;
  if (opts.filterMonth || opts.startMonth || opts.endMonth) {
    monthsToProcess = months.filter(({ year, month }) => {
      const yearMonth = `${year}-${month}`;
      return shouldProcessMonthWithOpts(yearMonth, opts);
    });
  }

  // Fetch Luma API data for each month
  if (process.env.LUMA_API_KEY) {
    console.log("\nFetching Luma API data...");

    for (const { year, month } of monthsToProcess) {
      process.stdout.write(`${year}-${month}: `);
      await fetchLumaForMonth(year, month);
    }
  } else {
    console.log("\nLUMA_API_KEY not set, skipping Luma API fetch");
  }

  console.log("\n✓ Events fetch complete!");

  // Return affected months as YYYY-MM strings
  return monthsToProcess.map(({ year, month }) => `${year}-${month}`);
}

/**
 * Fetch only event calendars (Luma ICS + Luma API). No room calendars.
 */
export async function fetchEventCalendars(
  opts: FetchCalendarsOptions = {}
): Promise<FetchCalendarsResult> {
  const quiet = opts.quiet ?? false;
  if (!quiet) {
    console.log("📅 Fetching event calendars...");
    console.log(`📂 DATA_DIR: ${opts.dataDir || DATA_DIR}\n`);
  }

  let totalEvents = 0;
  let upcomingEvents = 0;

  const calendars = (settings as any).calendars || {};
  const lumaIcsUrl = calendars.luma;

  if (lumaIcsUrl) {
    const result = await fetchAndSplitCalendarURL(lumaIcsUrl, "Luma", { quiet });
    totalEvents = result.totalEvents;
    upcomingEvents = result.upcomingEvents;
  }

  // Fetch main iCal feed by month (if configured)
  const mainIcalUrl = (settings.luma as any)?.icalUrl;
  if (mainIcalUrl) {
    await fetchAndSplitICal();
  }

  // Get months and filter
  const months = getAllMonths();
  let monthsToProcess = months;
  if (opts.filterMonth || opts.startMonth || opts.endMonth) {
    monthsToProcess = months.filter(({ year, month }) =>
      shouldProcessMonthWithOpts(`${year}-${month}`, opts)
    );
  }

  // Fetch Luma API data
  if (process.env.LUMA_API_KEY) {
    if (!quiet) console.log("\nFetching Luma API data...");
    for (const { year, month } of monthsToProcess) {
      if (!quiet) process.stdout.write(`${year}-${month}: `);
      await fetchLumaForMonth(year, month, { quiet });
    }
  } else {
    if (!quiet) console.log("\nLUMA_API_KEY not set, skipping Luma API fetch");
  }

  if (!quiet) console.log("\n✓ Event calendars fetch complete!");
  return {
    affectedMonths: monthsToProcess.map(({ year, month }) => `${year}-${month}`),
    totalEvents,
    upcomingEvents,
  };
}

/**
 * Fetch room booking calendars (Google Calendar ICS for each room).
 * @param roomSlug - if provided, only sync that room
 */
export async function fetchBookingCalendars(
  opts: FetchCalendarsOptions & { roomSlug?: string } = {}
): Promise<string[]> {
  console.log("📅 Fetching room booking calendars...");
  console.log(`📂 DATA_DIR: ${opts.dataDir || DATA_DIR}\n`);

  const roomsWithCalendars = roomsData.rooms.filter(
    (room) => room.googleCalendarId && (!opts.roomSlug || room.slug === opts.roomSlug)
  );

  if (roomsWithCalendars.length === 0) {
    if (opts.roomSlug) {
      console.log(`No room found with slug "${opts.roomSlug}" or it has no calendar.`);
    } else {
      console.log("No rooms with calendars found.");
    }
    return [];
  }

  console.log(`Fetching ${roomsWithCalendars.length} room calendar(s)...`);
  for (const room of roomsWithCalendars) {
    if (room.googleCalendarId) {
      const calendarUrl = getGoogleCalendarUrl(room.googleCalendarId);
      await fetchAndSplitCalendarURL(calendarUrl, room.slug);
    }
  }

  // Also fetch the main Google Calendar if configured
  const googleIcsUrl = (settings as any).calendars?.google;
  if (googleIcsUrl && !opts.roomSlug) {
    await fetchAndSplitCalendarURL(googleIcsUrl, "Google");
  }

  const months = getAllMonths();
  let monthsToProcess = months;
  if (opts.filterMonth || opts.startMonth || opts.endMonth) {
    monthsToProcess = months.filter(({ year, month }) =>
      shouldProcessMonthWithOpts(`${year}-${month}`, opts)
    );
  }

  console.log("\n✓ Booking calendars fetch complete!");
  return monthsToProcess.map(({ year, month }) => `${year}-${month}`);
}

/**
 * Main execution (standalone script)
 */
async function main() {
  await fetchCalendars();
}

// Only run main when executed directly (not imported)
const isDirectRun = process.argv[1]?.includes("fetch-calendars");
if (isDirectRun) {
  main().catch(console.error);
}
