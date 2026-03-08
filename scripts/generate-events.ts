/**
 * Generate events.json for each month and year
 * Consolidates cached iCal and Luma data with Open Graph metadata
 *
 * Generates:
 * - data/:year/:month/events.json - Monthly events
 * - data/:year/events.json - Yearly aggregated events
 * - data/:year/events.csv - Yearly events CSV export
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import ical from "node-ical";
import ogs from "open-graph-scraper";
import { addHours } from "date-fns";
import settings from "../src/settings/settings.json";
import type { LumaEvent } from "../src/lib/luma";
import { getEvent, getEventGuests, type LumaGuest } from "../src/lib/luma";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const IS_VERCEL = !!process.env.VERCEL;
const TIMEZONE = "Europe/Brussels";

// Get fridge account configuration from settings
const fridgeAccount = (settings.finance as any)?.accounts?.find(
  (acc: any) => acc.slug === "fridge"
);

interface Transaction {
  timeStamp: string; // Unix timestamp in seconds
  to: string;
  from: string;
  value: string;
  tokenDecimal: string;
}

interface TransactionsFile {
  transactions: Transaction[];
}

interface EventMetadata {
  host?: string;
  attendance?: number;
  fridgeIncome?: number;
  rentalIncome?: number;
  ticketsSold?: number;
  ticketRevenue?: number;
  note?: string;
}

interface EventGuest {
  name: string;
  avatar_url?: string;
  approval_status: string;
}

interface EventTag {
  name: string;
  color: string;
}

interface Event {
  id: string;
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  url?: string;
  coverImage?: string;
  coverImageLocal?: string;
  source: "luma" | "ical";
  calendarSource?: "luma-api" | "luma" | "google"; // Track which calendar it came from
  tags?: EventTag[];
  lumaData?: LumaEvent;
  guests?: EventGuest[];
  metadata: EventMetadata;
}

interface EventsFile {
  month: string;
  generatedAt: string;
  events: Event[];
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
 * Load existing events file to preserve metadata
 */
function loadExistingEvents(
  year: string,
  month: string
): Map<string, EventMetadata> {
  const filePath = path.join(DATA_DIR, year, month, "events.json");
  const metadataMap = new Map<string, EventMetadata>();

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data: EventsFile = JSON.parse(content);
      for (const event of data.events) {
        metadataMap.set(event.id, event.metadata);
      }
    } catch (error) {
      console.error(`Error reading existing events file:`, error);
    }
  }

  return metadataMap;
}

/**
 * Load cached iCal events for a month
 */
async function loadICalEvents(year: string, month: string): Promise<any[]> {
  const icalPath = path.join(
    DATA_DIR,
    year,
    month,
    "calendars",
    "ical",
    "calendar.ics"
  );

  if (!fs.existsSync(icalPath)) {
    console.log(`  No cached iCal data found at ${icalPath}`);
    return [];
  }

  try {
    const content = fs.readFileSync(icalPath, "utf-8");
    const events = await ical.async.parseICS(content);

    // Convert to array and filter only VEVENTs
    const eventArray = Object.values(events).filter(
      (event: any) => event.type === "VEVENT"
    );

    return eventArray;
  } catch (error) {
    console.error(`Error loading iCal events:`, error);
    return [];
  }
}

/**
 * Load cached calendar events from .ics files
 */
/**
 * Load cached calendar events from .ics files
 * Only loads luma.ics for public events (Google/room calendars kept as backup but not used)
 */
async function loadCachedCalendarEvents(
  year: string,
  month: string
): Promise<any[]> {
  const icsDir = path.join(DATA_DIR, year, month, "calendars", "ics");

  if (!fs.existsSync(icsDir)) {
    return [];
  }

  // Only load luma.ics — this is the single source of truth for public events
  const lumaIcsPath = path.join(icsDir, "luma.ics");
  if (!fs.existsSync(lumaIcsPath)) {
    console.log(`  No luma.ics found for ${year}-${month}`);
    return [];
  }

  try {
    const content = fs.readFileSync(lumaIcsPath, "utf-8");
    const events = await ical.async.parseICS(content);

    const eventArray = Object.values(events)
      .filter((event: any) => event.type === "VEVENT")
      .map((e) => ({ ...e, calendarSource: "luma" }));

    return eventArray;
  } catch (error) {
    console.error(`Error loading luma.ics:`, error);
    return [];
  }
}

/**
 * Load cached Luma events for a month
 */
function loadLumaEvents(year: string, month: string): Map<string, LumaEvent> {
  const lumaMap = new Map<string, LumaEvent>();
  const calendarId = (settings.luma as any)?.calendarId;

  if (!calendarId) {
    return lumaMap;
  }

  const lumaPath = path.join(
    DATA_DIR,
    year,
    month,
    "calendars",
    "luma",
    `${calendarId}.json`
  );

  if (!fs.existsSync(lumaPath)) {
    console.log(`  No cached Luma data found at ${lumaPath}`);
    return lumaMap;
  }

  try {
    const content = fs.readFileSync(lumaPath, "utf-8");
    const events: LumaEvent[] = JSON.parse(content);

    for (const event of events) {
      lumaMap.set(event.api_id, event);
      // Also index by name (lowercase) for matching
      if (event.name) {
        lumaMap.set(event.name.toLowerCase(), event);
      }
    }

    console.log(`  Loaded ${events.length} Luma events from cache`);
  } catch (error) {
    console.error(`Error loading Luma events:`, error);
  }

  return lumaMap;
}

/**
 * Extract Luma event ID from URL or text
 */
function extractLumaEventId(text?: string): string | null {
  if (!text) return null;

  const lumaPatterns = [/lu\.ma\/([a-z0-9-]+)/i, /luma\.com\/([a-z0-9-]+)/i];

  for (const pattern of lumaPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Load guests from cached JSON file
 */
function loadGuestsFromFile(
  eventId: string,
  year: string,
  month: string
): LumaGuest[] {
  const guestsPath = path.join(
    DATA_DIR,
    year,
    month,
    "calendars",
    "luma",
    "private",
    "guests",
    `${eventId}.json`
  );

  if (!fs.existsSync(guestsPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(guestsPath, "utf-8");
    const guests: LumaGuest[] = JSON.parse(content);
    return guests;
  } catch (error) {
    console.error(`Error loading guests from ${guestsPath}:`, error);
    return [];
  }
}

/**
 * Compute fridge income during an event time window
 * Looks at transactions from event start to 2 hours after event end
 */
function computeFridgeIncome(
  eventStartISO: string,
  eventEndISO: string | undefined,
  year: string,
  month: string
): number {
  if (!fridgeAccount) {
    return 0;
  }

  const { chain, address, token } = fridgeAccount;
  const tokenSymbol = token.symbol;
  const decimals = token.decimals;

  // Load transaction file
  const transactionsPath = path.join(
    DATA_DIR,
    year,
    month,
    chain,
    tokenSymbol,
    `${address}.json`
  );

  if (!fs.existsSync(transactionsPath)) {
    return 0;
  }

  try {
    const content = fs.readFileSync(transactionsPath, "utf-8");
    const data: TransactionsFile = JSON.parse(content);

    // Parse event times in Brussels timezone
    const eventStart = new Date(eventStartISO);
    const eventEnd = eventEndISO ? new Date(eventEndISO) : eventStart;

    // Add 2 hours buffer after event end
    const windowEnd = addHours(eventEnd, 2);

    // Convert to timestamps for comparison
    const startTimestamp = Math.floor(eventStart.getTime() / 1000);
    const endTimestamp = Math.floor(windowEnd.getTime() / 1000);

    // Filter and sum incoming transactions (where to === fridge address)
    const income = data.transactions
      .filter((tx) => {
        const txTimestamp = parseInt(tx.timeStamp);
        const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
        const isInTimeWindow =
          txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
        return isIncoming && isInTimeWindow;
      })
      .reduce((sum, tx) => {
        const value = parseFloat(tx.value);
        return sum + value / Math.pow(10, decimals);
      }, 0);

    return Math.round(income * 100) / 100; // Round to 2 decimals
  } catch (error) {
    console.error(`Error computing fridge income:`, error);
    return 0;
  }
}

/**
 * Fetch Open Graph metadata for a URL
 */
async function fetchOGMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
}> {
  try {
    const { result } = await ogs({ url });
    return {
      title: result.ogTitle || result.dcTitle,
      description: result.ogDescription || result.dcDescription,
      image: result.ogImage?.[0]?.url,
    };
  } catch (error) {
    console.error(`Error fetching OG metadata for ${url}:`, error);
    return {};
  }
}

/**
 * Extract actual image URL from Next.js image proxy URL
 */
function extractImageUrl(url: string): string {
  if (url.includes("_next/image?url=")) {
    const match = url.match(/url=([^&]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  return url;
}

/**
 * Download an image and save it locally
 * Returns the local path relative to the data directory
 */
async function downloadImage(
  imageUrl: string,
  eventId: string,
  year: string,
  month: string,
  source: "luma" | "ical"
): Promise<string | undefined> {
  if (IS_VERCEL) {
    return imageUrl; // Return original URL on Vercel
  }

  // Extract actual URL if it's a Next.js proxy URL
  const actualUrl = extractImageUrl(imageUrl);

  try {
    const response = await fetch(actualUrl);
    if (!response.ok) {
      console.error(
        `Failed to download image: ${response.status} ${response.statusText}`
      );
      return actualUrl;
    }

    // Get file extension from URL or Content-Type
    let extension = path.extname(new URL(actualUrl).pathname);
    if (!extension || extension === "") {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("jpeg") || contentType?.includes("jpg")) {
        extension = ".jpg";
      } else if (contentType?.includes("png")) {
        extension = ".png";
      } else if (contentType?.includes("webp")) {
        extension = ".webp";
      } else {
        extension = ".jpg"; // default
      }
    }

    // Clean up eventId - remove @events.lu.ma
    const cleanEventId = eventId.replace(/@events\.lu\.ma$/, "");

    // Create source-specific images directory under calendars/
    const imagesDir = path.join(DATA_DIR, year, month, "calendars", source, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Save image
    const filename = `${cleanEventId}${extension}`;
    const filepath = path.join(imagesDir, filename);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));

    // Return relative path from data directory
    return `/${year}/${month}/calendars/${source}/images/${filename}`;
  } catch (error) {
    console.error(`Error downloading image from ${actualUrl}:`, error);
    return actualUrl; // Fallback to original URL
  }
}

/**
 * Process events for a specific month
 */
async function processMonth(year: string, month: string) {
  console.log(`\n=== Generating events.json for ${year}-${month} ===`);

  const monthPath = path.join(DATA_DIR, year, month);
  if (!fs.existsSync(monthPath)) {
    console.log(`  Month directory does not exist: ${monthPath}`);
    return;
  }

  // Load existing metadata
  const existingMetadata = loadExistingEvents(year, month);
  console.log(`  Loaded ${existingMetadata.size} existing metadata entries`);

  // Load Luma API events (highest priority)
  const lumaEventsMap = loadLumaEvents(year, month);

  // Load public events from Luma ICS feed (single source of truth)
  const allICalEvents = await loadCachedCalendarEvents(year, month);
  console.log(`  Loaded ${allICalEvents.length} public events from Luma ICS`);

  // Process events
  const events: Event[] = [];
  const processedEventIds = new Set<string>();

  for (const icalEvent of allICalEvents) {
    const calendarSource = (icalEvent as any).calendarSource;
    const uid = icalEvent.uid || "";
    const name = icalEvent.summary || "Untitled Event";
    const description = icalEvent.description || undefined;

    // Dates may be Date objects or ISO strings (from JSON)
    const startAt =
      icalEvent.start instanceof Date
        ? icalEvent.start.toISOString()
        : typeof icalEvent.start === "string"
          ? icalEvent.start
          : "";
    const endAt =
      icalEvent.end instanceof Date
        ? icalEvent.end.toISOString()
        : typeof icalEvent.end === "string"
          ? icalEvent.end
          : undefined;

    const icalLocation = icalEvent.location || undefined;
    const icalUrl = icalEvent.url || undefined;

    let lumaData: LumaEvent | undefined;
    // Clean up eventId - remove @events.lu.ma
    let eventId = uid.replace(/@events\.lu\.ma$/, "");
    let source: "luma" | "ical" = "ical";
    let finalCalendarSource: "luma-api" | "luma" | "google" =
      calendarSource === "luma" ? "luma" : "google";
    let coverImageUrl: string | undefined;
    let eventUrl = icalUrl;
    let physicalLocation = icalLocation;
    let ogDescription: string | undefined;

    // Check if location field contains a URL (common for external events in Luma's iCal)
    if (
      icalLocation &&
      (icalLocation.startsWith("http://") ||
        icalLocation.startsWith("https://"))
    ) {
      // Swap: location has the URL, so use it as eventUrl
      eventUrl = icalLocation;
      // Physical location should be Commons Hub Brussels for these events
      physicalLocation =
        "Commons Hub Brussels, Rue de la Madeleine 51, 1000 Bruxelles, Belgium";
    }

    // Check for Luma event ID in URL or description
    let lumaEventId = extractLumaEventId(icalUrl || icalLocation);
    if (!lumaEventId && description) {
      lumaEventId = extractLumaEventId(description);
    }

    // Try to match with Luma data
    if (lumaEventId) {
      lumaData = lumaEventsMap.get(lumaEventId);
    }

    // Try name matching if no ID match
    if (!lumaData) {
      lumaData = lumaEventsMap.get(name.toLowerCase());
    }

    // If no match in cache, try fetching from Luma API by event ID (works for community events too)
    // The ICS UID contains the evt-xxx API ID, so use eventId (not the slug)
    if (!lumaData && eventId.startsWith("evt-") && process.env.LUMA_API_KEY) {
      try {
        const fetchedEvent = await getEvent(eventId);
        if (fetchedEvent) {
          lumaData = fetchedEvent;
          // Cache it in the map for potential name-based matches later
          lumaEventsMap.set(eventId, fetchedEvent);
          if (fetchedEvent.name) {
            lumaEventsMap.set(fetchedEvent.name.toLowerCase(), fetchedEvent);
          }
          console.log(`  ✓ Fetched community event from Luma API: ${name}`);
        }
      } catch (error) {
        console.error(`  ⚠ Failed to fetch event ${eventId} from Luma API`);
      }
    }

    // If we found Luma data, use it (highest priority)
    if (lumaData) {
      eventId = lumaData.api_id;
      source = "luma";
      finalCalendarSource = "luma-api"; // Luma API has highest priority
      coverImageUrl = lumaData.cover_url;
      eventUrl = lumaData.url;
      physicalLocation =
        lumaData.geo_address_json?.full_address || physicalLocation;
    } else {
      // For non-matched events, try to extract URL from description
      if (!eventUrl && description) {
        // Match URL but stop at common delimiters (whitespace, quotes, angle brackets, etc.)
        const urlMatch = description.match(/https?:\/\/[^\s\n<>"']+/);
        if (urlMatch) {
          eventUrl = urlMatch[0];
          // Clean up any trailing punctuation that might have been captured
          eventUrl = eventUrl.replace(/[.,;:!?]+$/, "");
        }
      }

      // Fallback: scrape og:image from the event URL
      if (eventUrl) {
        const ogData = await fetchOGMetadata(eventUrl);
        if (ogData.image) {
          // Extract actual URL if it's a Next.js proxy URL
          coverImageUrl = extractImageUrl(ogData.image);
        }
        if (ogData.description) {
          ogDescription = ogData.description;
        }
      }
    }

    // Download cover image if available and get local path
    let coverImageLocal: string | undefined;
    if (coverImageUrl) {
      coverImageLocal = await downloadImage(
        coverImageUrl,
        eventId,
        year,
        month,
        source
      );
    }

    // Load guests for Luma events from file (or fetch if not available)
    let guests: EventGuest[] | undefined;
    let allGuests: LumaGuest[] = [];

    if (lumaData && lumaData.api_id) {
      // Try to load from file first
      allGuests = loadGuestsFromFile(eventId, year, month);

      // If not in file, fetch from API
      if (allGuests.length === 0) {
        allGuests = await getEventGuests(lumaData.api_id);
      }

      // Filter approved guests for public display and remove email addresses
      guests = allGuests
        .filter((g) => g.guest.approval_status === "approved")
        .map((g) => ({
          name: g.guest.name,
          avatar_url: g.guest.avatar_url,
          approval_status: g.guest.approval_status,
        }));
    }

    // Compute ticket statistics from guests using event_tickets array
    let ticketsSold = 0;
    let ticketRevenue = 0;

    for (const g of allGuests) {
      // Use event_tickets array if available (more accurate)
      if (g.guest.event_tickets && g.guest.event_tickets.length > 0) {
        for (const ticket of g.guest.event_tickets) {
          // Only count captured tickets (confirmed payments)
          if (ticket.is_captured && ticket.amount > 0) {
            ticketsSold++;
            // Amount is in cents, convert to euros
            ticketRevenue += ticket.amount / 100;
          }
        }
      } else {
        // Fallback to event_ticket (older structure)
        const amount = g.guest.event_ticket?.amount;
        if (amount !== undefined && amount > 0) {
          ticketsSold++;
          ticketRevenue += amount / 100;
        }
      }
    }

    // Get metadata (preserve existing or use defaults)
    let metadata = existingMetadata.get(eventId) || {
      host: undefined,
      attendance: undefined,
      fridgeIncome: undefined,
      rentalIncome: undefined,
      ticketsSold: undefined,
      ticketRevenue: undefined,
      note: undefined,
    };

    // Set attendance from approved guest count if available and not already set
    const guestCount =
      guests && guests.length > 0 ? guests.length : lumaData?.guest_count;
    if (guestCount && !metadata.attendance) {
      metadata = { ...metadata, attendance: guestCount };
    }

    // Set ticket statistics if we have guests data and not already set
    if (ticketsSold > 0 && !metadata.ticketsSold) {
      metadata = { ...metadata, ticketsSold, ticketRevenue };
    }

    // Compute fridge income if not already set
    if (!metadata.fridgeIncome) {
      const finalStartAt = lumaData?.start_at || startAt;
      const finalEndAt = lumaData?.end_at || endAt;
      const fridgeIncome = computeFridgeIncome(
        finalStartAt,
        finalEndAt,
        year,
        month
      );
      if (fridgeIncome > 0) {
        metadata = { ...metadata, fridgeIncome };
      }
    }

    // Check for duplicate event ID
    if (processedEventIds.has(eventId)) {
      console.log(
        `  ⚠️  Skipping duplicate event by ID: ${name} (ID: ${eventId})`
      );
      continue;
    }

    processedEventIds.add(eventId);

    // Determine final description
    // Priority: Luma API description > OG description > ICS description
    // ICS descriptions from Luma are usually just "Get up-to-date information at: ..."
    let finalDescription = lumaData?.description || ogDescription || description;
    // If still a stub description, try OG
    if (
      finalDescription?.startsWith("Get up-to-date information at:") ||
      finalDescription?.startsWith("Find more information on https://luma.com")
    ) {
      finalDescription = ogDescription || finalDescription;
    }

    // Extract tags from Luma cached data (tags are stored as Array<{name, color}>)
    const eventTags: EventTag[] | undefined = lumaData?.tags
      ? (lumaData.tags as any[]).map((t: any) =>
          typeof t === "string" ? { name: t, color: "#6b7280" } : { name: t.name, color: t.color || "#6b7280" }
        )
      : undefined;

    // Create event object
    const event: Event = {
      id: eventId,
      name,
      description: finalDescription,
      startAt: lumaData?.start_at || startAt,
      endAt: lumaData?.end_at || endAt,
      timezone: lumaData?.timezone,
      location: physicalLocation,
      url: eventUrl,
      coverImage: coverImageUrl, // Keep original URL
      coverImageLocal, // Local downloaded path
      source,
      calendarSource: finalCalendarSource,
      tags: eventTags,
      guests,
      lumaData: lumaData
        ? {
            api_id: lumaData.api_id,
            start_at: lumaData.start_at,
            end_at: lumaData.end_at,
            timezone: lumaData.timezone,
            url: lumaData.url,
            cover_url: lumaData.cover_url,
            geo_address_json: lumaData.geo_address_json,
            meeting_url: lumaData.meeting_url,
            visibility: lumaData.visibility,
            event_type: lumaData.event_type,
            capacity: lumaData.capacity,
            guest_count: lumaData.guest_count,
            hosts: lumaData.hosts,
            hosted_by: lumaData.hosted_by,
          }
        : undefined,
      metadata,
    };

    events.push(event);
  }

  // Sort events by start date
  events.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Write events file
  const eventsFile: EventsFile = {
    month: `${year}-${month}`,
    generatedAt: new Date().toISOString(),
    events,
  };

  const filePath = path.join(monthPath, "events.json");
  fs.writeFileSync(filePath, JSON.stringify(eventsFile, null, 2), "utf-8");
  console.log(`✓ Generated ${filePath} with ${events.length} events`);
  console.log(
    `  Luma API events: ${events.filter((e) => e.calendarSource === "luma-api").length}`
  );
  console.log(
    `  Luma ICS events: ${events.filter((e) => e.calendarSource === "luma").length}`
  );
  console.log(
    `  Google ICS events: ${events.filter((e) => e.calendarSource === "google").length}`
  );
}

/**
 * Generate yearly events.json file
 */
async function generateYearlyEvents(year: string): Promise<void> {
  console.log(`\n📄 Generating events.json for ${year}...`);

  const yearPath = path.join(DATA_DIR, year);
  if (!fs.existsSync(yearPath)) {
    console.log(`  ⚠️  Year directory not found: ${year}`);
    return;
  }

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  const allEvents: Event[] = [];

  // Load all events from each month
  for (const month of monthDirs) {
    const eventsPath = path.join(yearPath, month, "events.json");
    if (fs.existsSync(eventsPath)) {
      try {
        const content = fs.readFileSync(eventsPath, "utf-8");
        const data: EventsFile = JSON.parse(content);
        allEvents.push(...data.events);
      } catch (error) {
        console.error(`  ✗ Error reading events for ${year}-${month}:`, error);
      }
    }
  }

  if (allEvents.length === 0) {
    console.log(`  ⚠️  No events found for ${year}`);
    return;
  }

  // Sort by start date
  allEvents.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Write yearly events file
  const outputFile: EventsFile = {
    month: year,
    generatedAt: new Date().toISOString(),
    events: allEvents,
  };

  const outputPath = path.join(DATA_DIR, year, "events.json");
  fs.writeFileSync(outputPath, JSON.stringify(outputFile, null, 2), "utf-8");

  console.log(`  ✓ Generated events.json with ${allEvents.length} events`);
}

/**
 * Generate yearly events.csv file
 */
async function generateYearlyEventsCSV(year: string): Promise<void> {
  console.log(`\n📄 Generating events.csv for ${year}...`);

  const yearPath = path.join(DATA_DIR, year);
  if (!fs.existsSync(yearPath)) {
    console.log(`  ⚠️  Year directory not found: ${year}`);
    return;
  }

  // Get all month directories
  const monthDirs = fs
    .readdirSync(yearPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && /^\d{2}$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();

  const allEvents: Event[] = [];

  // Load all events from each month
  for (const month of monthDirs) {
    const eventsPath = path.join(yearPath, month, "events.json");
    if (fs.existsSync(eventsPath)) {
      try {
        const content = fs.readFileSync(eventsPath, "utf-8");
        const data: EventsFile = JSON.parse(content);
        allEvents.push(...data.events);
      } catch (error) {
        console.error(`  ✗ Error reading events for ${year}-${month}:`, error);
      }
    }
  }

  if (allEvents.length === 0) {
    console.log(`  ⚠️  No events found for ${year}`);
    return;
  }

  // Sort by start date
  allEvents.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Generate CSV content
  const headers = [
    "Event ID",
    "Calendar Source",
    "Date",
    "Time",
    "Event Name",
    "Host",
    "Attendance",
    "Tickets Sold",
    "Ticket Revenue (EUR)",
    "Fridge Income (EUR)",
    "Rental Income (EUR)",
    "Location",
    "URL",
    "Note",
  ];

  const rows = allEvents.map((event) => {
    const startDate = new Date(event.startAt);
    const dateStr = startDate.toLocaleDateString("en-GB");
    const timeStr = startDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return [
      event.id,
      event.calendarSource || "",
      dateStr,
      timeStr,
      event.name,
      event.metadata.host || "",
      event.metadata.attendance?.toString() || "",
      event.metadata.ticketsSold?.toString() || "",
      event.metadata.ticketRevenue?.toFixed(2) || "",
      event.metadata.fridgeIncome?.toFixed(2) || "",
      event.metadata.rentalIncome?.toFixed(2) || "",
      event.location || "",
      event.url || "",
      event.metadata.note || "",
    ];
  });

  // Escape CSV cells
  const escapeCsvCell = (cell: string): string => {
    const cellStr = String(cell);
    if (
      cellStr.includes(",") ||
      cellStr.includes('"') ||
      cellStr.includes("\n")
    ) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  };

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n");

  // Write CSV file
  const csvPath = path.join(DATA_DIR, year, "events.csv");
  fs.writeFileSync(csvPath, csvContent, "utf-8");

  console.log(`  ✓ Generated events.csv with ${allEvents.length} events`);
}

/**
 * Copy directory recursively
 */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Generate latest events.json and calendars/ directory
 * Copies the most recent month's data to data/latest/
 */
async function generateLatestEvents(): Promise<void> {
  console.log("\n📌 Generating latest/events.json...");

  // Find the most recent month with events.json
  const months = getAllMonths().reverse(); // newest first

  for (const { year, month } of months) {
    const eventsPath = path.join(DATA_DIR, year, month, "events.json");
    if (fs.existsSync(eventsPath)) {
      const latestDir = path.join(DATA_DIR, "latest");

      // Copy events.json
      fs.mkdirSync(latestDir, { recursive: true });
      fs.copyFileSync(eventsPath, path.join(latestDir, "events.json"));

      // Copy calendars/ directory for image references
      const srcCalendars = path.join(DATA_DIR, year, month, "calendars");
      const dstCalendars = path.join(latestDir, "calendars");
      if (fs.existsSync(srcCalendars)) {
        // Remove old latest calendars and copy fresh
        if (fs.existsSync(dstCalendars)) {
          fs.rmSync(dstCalendars, { recursive: true });
        }
        copyDirRecursive(srcCalendars, dstCalendars);
      }

      console.log(`  ✓ Generated latest/events.json from ${year}-${month}`);
      return;
    }
  }

  console.log("  ⚠️  No events.json found in any month directory");
}

/**
 * Main execution
 */
async function main() {
  console.log("Starting events generation...");

  const months = getAllMonths();

  if (months.length === 0) {
    console.log("No month directories found in data folder.");
    return;
  }

  for (const { year, month } of months) {
    await processMonth(year, month);
  }

  // Generate yearly aggregated files for each unique year
  const uniqueYears = [...new Set(months.map((m) => m.year))];
  for (const year of uniqueYears) {
    await generateYearlyEvents(year);
    await generateYearlyEventsCSV(year);
  }

  // Generate latest events.json and calendars/
  await generateLatestEvents();

  console.log("\n✓ Events generation complete!");
}

main().catch(console.error);
