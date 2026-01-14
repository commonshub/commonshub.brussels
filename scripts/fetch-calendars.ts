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
  calendarName: string
): Promise<void> {
  console.log(`Fetching ${calendarName} calendar from ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `  Failed to fetch ${calendarName} calendar: ${response.statusText}`
      );
      return;
    }

    const icalData = await response.text();
    console.log(`Parsing ${calendarName} events...`);
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

    console.log(
      `Found ${Object.keys(events).length} events across ${eventsByMonth.size} different months\n`
    );

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
        console.log(
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

      console.log(
        `✓ Saved ${monthEventBlocks.length} ${calendarName} events to ${year}/${month}/calendars/ics/${calendarSlug}.ics`
      );
    }

    // Download images for events with URLs
    console.log(`\nDownloading ${calendarName} event images...`);
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
  } catch (error) {
    console.error(`Error fetching ${calendarName} calendar:`, error);
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
async function fetchLumaForMonth(year: string, month: string) {
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
    console.log(
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

    if (events.length > 0) {
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

    if (downloadedCount > 0) {
      console.log(`  ✓ Downloaded ${downloadedCount} Luma event images`);
    }
  } catch (error) {
    // Silently fail for Luma API - not critical
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("Starting events fetch...\n");

  // Fetch calendar URLs from settings
  const calendars = (settings as any).calendars || {};
  const lumaIcsUrl = calendars.luma;
  const googleIcsUrl = calendars.google;

  // Fetch and split calendar URLs by month
  if (lumaIcsUrl) {
    await fetchAndSplitCalendarURL(lumaIcsUrl, "Luma");
  }

  if (googleIcsUrl) {
    await fetchAndSplitCalendarURL(googleIcsUrl, "Google");
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
    return;
  }

  // Fetch Luma API data for each month
  if (process.env.LUMA_API_KEY) {
    console.log("\nFetching Luma API data...");

    // If month filter is specified, only process filtered months
    let monthsToProcess = months;
    if (FILTER_MONTH || START_MONTH || END_MONTH) {
      monthsToProcess = months.filter(({ year, month }) => {
        const yearMonth = `${year}-${month}`;
        return shouldProcessMonth(yearMonth);
      });
    }

    for (const { year, month } of monthsToProcess) {
      process.stdout.write(`${year}-${month}: `);
      await fetchLumaForMonth(year, month);
    }
  } else {
    console.log("\nLUMA_API_KEY not set, skipping Luma API fetch");
  }

  console.log("\n✓ Events fetch complete!");
}

main().catch(console.error);
