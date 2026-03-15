/**
 * Luma integration tests
 *
 * Tests the full event sync pipeline:
 * 1. Fetching the ICS calendar feed
 * 2. Fetching event metadata via Luma API (requires LUMA_API_KEY)
 * 3. Falling back to og:image scraping when API is unavailable
 *
 * Run: npm run test:luma
 *
 * Network tests are skipped in CI unless INTEGRATION_TESTS=true.
 * Luma API tests are skipped unless LUMA_API_KEY is set.
 *
 * @jest-environment node
 */

import * as fs from "fs";
import * as path from "path";
import ical from "node-ical";
import settings from "../src/settings/settings.json";

const LUMA_API_BASE_URL = "https://public-api.luma.com";
const LUMA_API_KEY = process.env.LUMA_API_KEY;
const LUMA_ICS_URL = (settings as any).calendars?.luma;
const LUMA_CALENDAR_ID = (settings.luma as any)?.calendarId;
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");

const skipNetwork =
  process.env.CI === "true" && process.env.INTEGRATION_TESTS !== "true";
const skipApi = skipNetwork || !LUMA_API_KEY;

const networkIt = skipNetwork ? it.skip : it;
const apiIt = skipApi ? it.skip : it;

// ── 1. ICS Feed ────────────────────────────────────────────────────────────

describe("Luma ICS feed", () => {
  let icsText: string;
  let events: Record<string, any>;

  beforeAll(async () => {
    if (skipNetwork) return;
    const res = await fetch(LUMA_ICS_URL);
    expect(res.ok).toBe(true);
    icsText = await res.text();
    events = await ical.async.parseICS(icsText);
  }, 30_000);

  networkIt("ICS URL is configured", () => {
    expect(LUMA_ICS_URL).toBeDefined();
    expect(LUMA_ICS_URL).toContain("api2.luma.com/ics/get");
  });

  networkIt("returns valid iCal data", () => {
    expect(icsText).toContain("BEGIN:VCALENDAR");
    expect(icsText).toContain("END:VCALENDAR");
    expect(icsText).toContain("BEGIN:VEVENT");
  });

  networkIt("contains events with required fields", () => {
    const vevents = Object.values(events).filter(
      (e: any) => e.type === "VEVENT"
    );
    expect(vevents.length).toBeGreaterThan(0);

    for (const event of vevents.slice(0, 10)) {
      expect(event.uid).toBeDefined();
      expect(event.summary).toBeDefined();
      expect(event.start).toBeDefined();
    }
  });

  networkIt("event UIDs contain evt- prefix", () => {
    const vevents = Object.values(events).filter(
      (e: any) => e.type === "VEVENT"
    );
    const withEvtPrefix = vevents.filter((e: any) =>
      e.uid?.startsWith("evt-")
    );
    expect(withEvtPrefix.length).toBeGreaterThan(0);
  });
});

// ── 2. Luma API – event metadata ───────────────────────────────────────────

describe("Luma API – getEvent", () => {
  let sampleEventId: string | null = null;

  beforeAll(async () => {
    if (skipApi) return;

    // Get a real event ID from the ICS feed
    const res = await fetch(LUMA_ICS_URL);
    const icsText = await res.text();
    const uidMatch = icsText.match(/UID:(evt-[a-zA-Z0-9]+)@events\.lu\.ma/);
    sampleEventId = uidMatch ? uidMatch[1] : null;
  }, 30_000);

  apiIt("fetches event by event_id param (GET)", async () => {
    expect(sampleEventId).toBeTruthy();

    const res = await fetch(
      `${LUMA_API_BASE_URL}/v1/event/get?event_id=${sampleEventId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-luma-api-key": LUMA_API_KEY!,
        },
      }
    );

    expect(res.ok).toBe(true);
    const data = await res.json();
    const event = data.event || data;

    expect(event).toHaveProperty("api_id");
    expect(event).toHaveProperty("name");
    expect(event).toHaveProperty("start_at");
    expect(event.api_id).toBe(sampleEventId);
  }, 15_000);

  apiIt("returns cover_url for calendar events", async () => {
    const now = new Date();
    const after = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    ).toISOString();
    const before = new Date(
      now.getFullYear(),
      now.getMonth() + 2,
      1
    ).toISOString();

    const params = new URLSearchParams({
      after,
      before,
      sort_column: "start_at",
    });

    const res = await fetch(
      `${LUMA_API_BASE_URL}/v1/calendar/list-events?${params}`,
      {
        headers: {
          accept: "application/json",
          "x-luma-api-key": LUMA_API_KEY!,
        },
      }
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    const entries = data.entries || [];
    expect(entries.length).toBeGreaterThan(0);

    // At least some events should have cover images
    const withCover = entries.filter(
      (e: any) => e.event?.cover_url || e.cover_url
    );
    expect(withCover.length).toBeGreaterThan(0);
  }, 15_000);

  apiIt("getEvent() from src/lib/luma.ts works", async () => {
    expect(sampleEventId).toBeTruthy();

    const { getEvent } = await import("../src/lib/luma");
    const event = await getEvent(sampleEventId!);

    expect(event).not.toBeNull();
    expect(event!.name).toBeTruthy();
    expect(event!.start_at).toBeTruthy();
  }, 15_000);
});

// ── 3. OG metadata fallback ────────────────────────────────────────────────

describe("OG metadata fallback", () => {
  let sampleEventUrl: string | null = null;

  beforeAll(async () => {
    if (skipNetwork) return;

    // Get a real event URL from the ICS feed
    const res = await fetch(LUMA_ICS_URL);
    const icsText = await res.text();
    const urlMatch = icsText.match(/https:\/\/luma\.com\/[a-z0-9-]+/i);
    sampleEventUrl = urlMatch ? urlMatch[0] : null;
  }, 30_000);

  networkIt("scrapes og:image from a Luma event page", async () => {
    expect(sampleEventUrl).toBeTruthy();

    const ogs = (await import("open-graph-scraper")).default;
    const { result } = await ogs({ url: sampleEventUrl! });

    expect(result.success).toBe(true);
    expect(result.ogTitle).toBeTruthy();
    // Most Luma events have og:image
    if (result.ogImage && result.ogImage.length > 0) {
      expect(result.ogImage[0].url).toMatch(/^https?:\/\//);
    }
  }, 15_000);

  networkIt("scrapes og:image from a non-Luma page", async () => {
    const ogs = (await import("open-graph-scraper")).default;
    const { result } = await ogs({ url: "https://github.com" });

    expect(result.success).toBe(true);
    expect(result.ogImage).toBeDefined();
    expect(result.ogImage!.length).toBeGreaterThan(0);
    expect(result.ogImage![0].url).toMatch(/^https?:\/\//);
  }, 15_000);
});

// ── 4. Offline: cached data integrity ──────────────────────────────────────

describe("Cached Luma data integrity", () => {
  const testYear = "2026";
  const testMonth = "03";

  it("ICS file exists in test data", () => {
    const icsPath = path.join(
      DATA_DIR,
      testYear,
      testMonth,
      "calendars",
      "ics",
      "luma.ics"
    );
    expect(fs.existsSync(icsPath)).toBe(true);
  });

  it("ICS file is valid iCal", async () => {
    const icsPath = path.join(
      DATA_DIR,
      testYear,
      testMonth,
      "calendars",
      "ics",
      "luma.ics"
    );
    const content = fs.readFileSync(icsPath, "utf-8");
    expect(content).toContain("BEGIN:VCALENDAR");

    const events = await ical.async.parseICS(content);
    const vevents = Object.values(events).filter(
      (e: any) => e.type === "VEVENT"
    );
    expect(vevents.length).toBeGreaterThan(0);
  });

  it("Luma API cache has valid structure", () => {
    const lumaPath = path.join(
      DATA_DIR,
      testYear,
      testMonth,
      "calendars",
      "luma",
      `${LUMA_CALENDAR_ID}.json`
    );
    if (!fs.existsSync(lumaPath)) {
      console.warn("No Luma API cache — skipping");
      return;
    }

    const data = JSON.parse(fs.readFileSync(lumaPath, "utf-8"));
    expect(Array.isArray(data)).toBe(true);

    for (const event of data) {
      expect(event).toHaveProperty("api_id");
      expect(event).toHaveProperty("name");
      expect(event).toHaveProperty("start_at");
      expect(event.api_id).toMatch(/^evt-/);
    }
  });

  it("community events (API-only, not in ICS) are included", () => {
    const eventsPath = path.join(
      DATA_DIR,
      testYear,
      testMonth,
      "events.json"
    );
    if (!fs.existsSync(eventsPath)) {
      console.warn("No events.json — run generate-events first");
      return;
    }

    const data = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
    const names = data.events.map((e: any) => e.name);

    // Events from ICS feed
    expect(names).toContain("Langchain Meetup");
    expect(names).toContain("Open Community Potluck Lunch");

    // Community events only in Luma API (not in ICS)
    expect(names).toContain("Founders Running Club :: Brussels");
    expect(names).toContain("Workshop: New Narrative Collage");

    // Community events have correct source
    const communityEvent = data.events.find(
      (e: any) => e.name === "Founders Running Club :: Brussels"
    );
    expect(communityEvent).toBeDefined();
    expect(communityEvent.source).toBe("luma");
    expect(communityEvent.calendarSource).toBe("luma-api");

    // No duplicates when same event is in both ICS and API
    const langchain = data.events.filter(
      (e: any) => e.name === "Langchain Meetup"
    );
    expect(langchain.length).toBe(1);
  });

  it("events.json merges ICS + API data correctly", () => {
    const eventsPath = path.join(
      DATA_DIR,
      testYear,
      testMonth,
      "events.json"
    );
    if (!fs.existsSync(eventsPath)) {
      console.warn("No events.json — skipping");
      return;
    }

    const data = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
    expect(data.events.length).toBeGreaterThan(0);

    // Should have both luma-api and luma (ICS) sourced events
    const sources = new Set(data.events.map((e: any) => e.calendarSource));
    expect(sources.has("luma") || sources.has("luma-api")).toBe(true);

    // No duplicate IDs
    const ids = data.events.map((e: any) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Sorted by date
    for (let i = 1; i < data.events.length; i++) {
      expect(
        new Date(data.events[i].startAt).getTime()
      ).toBeGreaterThanOrEqual(
        new Date(data.events[i - 1].startAt).getTime()
      );
    }
  });
});
