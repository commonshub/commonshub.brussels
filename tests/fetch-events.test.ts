/**
 * Tests for fetch-events script
 */

import * as fs from "fs";
import * as path from "path";
import ical from "node-ical";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "tests/data");
const TEST_YEAR = "2025";
const TEST_MONTH = "11";

describe("Fetch Events Script", () => {
  const icsDir = path.join(
    DATA_DIR,
    TEST_YEAR,
    TEST_MONTH,
    "calendars",
    "ics"
  );

  test("calendars/ics directory exists for test month", () => {
    expect(fs.existsSync(icsDir)).toBe(true);
  });

  test("calendars/ics contains .ics files", () => {
    const files = fs.readdirSync(icsDir);
    const icsFiles = files.filter(f => f.endsWith(".ics"));
    expect(icsFiles.length).toBeGreaterThan(0);
  });

  test("all .ics files have valid iCal format", () => {
    const files = fs.readdirSync(icsDir);
    const icsFiles = files.filter(f => f.endsWith(".ics"));

    icsFiles.forEach(file => {
      const content = fs.readFileSync(path.join(icsDir, file), "utf-8");

      // Check iCal structure
      expect(content).toContain("BEGIN:VCALENDAR");
      expect(content).toContain("END:VCALENDAR");
      expect(content).toContain("VERSION:2.0");
      expect(content).toContain("PRODID:");
    });
  });

  test("all events in .ics files start or occur during the correct month", async () => {
    const files = fs.readdirSync(icsDir);
    const icsFiles = files.filter(f => f.endsWith(".ics"));

    for (const file of icsFiles) {
      const content = fs.readFileSync(path.join(icsDir, file), "utf-8");
      const events = await ical.async.parseICS(content);

      const eventArray = Object.values(events).filter(
        (event: any) => event.type === "VEVENT"
      );

      expect(eventArray.length).toBeGreaterThan(0);

      for (const event of eventArray) {
        const startDate = event.start as Date;
        const endDate = event.end as Date;
        expect(startDate).toBeDefined();

        const eventYear = startDate.getFullYear().toString();
        const eventMonth = String(startDate.getMonth() + 1).padStart(2, "0");

        // Use UTC dates to match iCal event dates
        const monthStart = new Date(Date.UTC(parseInt(TEST_YEAR), parseInt(TEST_MONTH) - 1, 1));
        const monthEnd = new Date(Date.UTC(parseInt(TEST_YEAR), parseInt(TEST_MONTH), 0, 23, 59, 59, 999));

        // Event should start in the month OR span across the month
        // Allow some tolerance for events at month boundaries (within 2 days)
        // Calendar feeds often include events slightly outside the month for timezone handling
        const startsInMonth = startDate >= monthStart && startDate <= monthEnd;
        const spansMonth = endDate && startDate < monthStart && endDate >= monthStart;
        const daysDiff = (startDate.getTime() - monthEnd.getTime()) / (1000 * 60 * 60 * 24);
        const isNearMonthBoundary = daysDiff > 0 && daysDiff <= 2; // within 2 days after month end

        if (!startsInMonth && !spansMonth && !isNearMonthBoundary) {
          console.warn(`Event significantly outside month: ${event.summary}`);
          console.warn(`  Start: ${startDate.toISOString()}`);
          console.warn(`  Days after month end: ${daysDiff.toFixed(2)}`);
        }

        expect(startsInMonth || spansMonth || isNearMonthBoundary).toBe(true);
      }
    }
  });

  test("events have required iCal fields", async () => {
    const files = fs.readdirSync(icsDir);
    const icsFiles = files.filter(f => f.endsWith(".ics"));

    for (const file of icsFiles) {
      const content = fs.readFileSync(path.join(icsDir, file), "utf-8");
      const events = await ical.async.parseICS(content);

      const eventArray = Object.values(events).filter(
        (event: any) => event.type === "VEVENT"
      );

      for (const event of eventArray) {
        expect(event.uid).toBeDefined();
        expect(event.summary || event.name).toBeDefined();
        expect(event.start).toBeDefined();
      }
    }
  });

  test("Luma cache exists and has valid structure", () => {
    const lumaPath = path.join(
      DATA_DIR,
      TEST_YEAR,
      TEST_MONTH,
      "calendars",
      "luma",
      "cal-kWlIiw3HsJFhs25.json"
    );

    // This may not exist if LUMA_API_KEY is not set
    if (fs.existsSync(lumaPath)) {
      const content = fs.readFileSync(lumaPath, "utf-8");
      const data = JSON.parse(content);

      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const firstEvent = data[0];
        expect(firstEvent).toHaveProperty("api_id");
        expect(firstEvent).toHaveProperty("name");
        expect(firstEvent).toHaveProperty("start_at");
      }
    }
  });
});
